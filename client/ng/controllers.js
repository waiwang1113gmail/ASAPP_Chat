var app = angular.module("controllers",['constants','chatResource']);
app.controller("welcomeCtrl",["$scope",'$location','$rootScope','UserService',function($scope,$location,$rootScope,UserService){
    UserService.currentUser(function(data){ 
        $location.path( "/chat_room" );   
    },function(){
        $location.path( "/login" );   
    }); 
}]).controller("loginCtrl",["$scope",'$location','$rootScope','UserService',function($scope,$location,$rootScope,UserService){
    UserService.currentUser(function(data){ 
        $location.path( "/chat_room" );   
    });
    $scope.name="";
    $scope.showError=false;
    $scope.login=function(){
        UserService.login({},{ 'name' : $scope.name },function(){
            $location.path( "/chat_room" );  
        },function(){
            $scope.showError = "Fail to login";
        }); 
    }
}]).controller("chatRoomCtrl",["$scope",'$location','$rootScope','ChatRoomService','UserService',
    function($scope,$location,$rootScope,ChatRoomService,UserService){
        $scope.chatRooms = [];
        $scope.join = function(room){
            ChatRoomService.joinRoom({}, { 'room' : room._id },function(){
                $location.path( "/my_room" );  
            },function(){
                $scope.showError = "Oops, failed to join the chat room!";
            });
        }
        $scope.newRoomName="";
        $scope.createRoom = function(){
            ChatRoomService.newRoom({},{ 'name' : $scope.newRoomName },function(){
                $location.path( "/my_room" );
            },function(){
                $scope.showError = "Oops, failed to creat new chat room!";
            });
        } 

        UserService.currentUser(function(currentUser){
            $scope.currentUser=currentUser;
            ChatRoomService.allRoom(function(rooms){
                rooms.forEach(function(room){
                    $scope.currentUser.chatRoomStatus.forEach(function(roomStatus){
                        if(roomStatus.rid==room._id){
                            room.alreadyJoined=true;
                        }
                    });
                    $scope.chatRooms.push(room);
                });
            })
        },function(){
            $location.path("/login");
        });
}]).controller("myRoomCtrl",["$scope",'$location','$rootScope','defaultUpdateFrequency','UserService','ChatRoomService',
    function($scope,$location,$rootScope,defaultUpdateFrequency,UserService,ChatRoomService){
        //Contains all chat rooms that current user has joined
        $scope.chatRooms = [];
        //Chat messages for selected chat room
        $scope.chatMessages = [];
        //Current chat room the user is in
        $scope.currentRoom = null;
        $scope.chatRoomUsers = [];
        //Holding new  message
        $scope.newMessage = "";
        //current login user
        $scope.currentUser;

        var socket; 

        function cleanUp(){ 
            
            $scope.showError=null;
            $scope.chatMessages = [];
            $scope.chatRoomUsers = [];
            $scope.newMessage = ""; 
            if(socket) socket.disconnect();
        }
        $scope.$on("$destroy", function() { 
            cleanUp();
        });

        function addMessage(msg){
            msg=msg.data;
            msg.timestamp=new Date(msg.timestamp);
            UserService.query({id:msg.uid},function(userResponse){
                msg.sentByMe=msg.uid===$scope.currentUser._id;
                msg.author=(msg.uid===$scope.currentUser._id)?"me":userResponse.name;
                $scope.chatMessages.push(msg);
            });
            UserService.lastUpdate({rid:msg.rid},{"timestamp":msg.timestamp},function(){
                console.log("update timestamp successfully");
            },function(){
                console.log("failed to update timestamp");
            })
        }
        //Retrieve all messages since last update for given chat room
        function retrieveMessages(rid,callback){ 
            ChatRoomService.allMessagesSinceLastUpdate({id:rid},function(messages){ 
                if(callback) callback();
                var loadingFinishCallback = (function (messages){
                    var counter=messages.length;
                    var results= [];
                    return function(msg){
                        results.push(msg);
                        if(--counter==0)  $scope.chatMessages= $scope.chatMessages.concat(results);
                    };
                })(messages);
                messages.forEach(function(msg){
                    msg.timestamp=new Date(msg.timestamp);
                    UserService.query({id:msg.uid},function(userResponse){
                        msg.sentByMe=msg.uid===$scope.currentUser._id;
                        msg.author=(msg.uid===$scope.currentUser._id)?"me":userResponse.name;
                        loadingFinishCallback(msg);
                    });     
                });
            },function(){
                showError("Oops, failed to fetch messages from server!");
            });
        }
        $scope.sendMessage=function(){ 
            socket.emit("message",{
                rid:$scope.currentRoom._id,
                message: $scope.newMessage 
            });

            $scope.newMessage ="";
        }
        $scope.selectRoom = function(room){
            if(room === $scope.currentRoom) return;
            cleanUp();

            //set the room to be selected and deselect other rooms
            $scope.chatRooms.forEach(function(r){r.selected=false;});
            room.selected=true;
            $scope.currentRoom = room;
            function activeUser(uid,active){
                var found=false;
                $scope.chatRoomUsers.forEach(function(chatUser){
                    if(chatUser._id===uid){
                        found=true;
                        chatUser.active=active;
                        var msg={systemMessage:true}
                        msg.timestamp=new Date();
                        msg["message"]=active? chatUser.name+" has joined the chat room!":chatUser.name+" has left the chat room!"
                        console.log(msg);
                        $scope.chatMessages.push(msg);
                        $scope.$apply();
                    }

                });
                //New client so we need to update our chat room clientlist
                if(!found){
                    UserService.query({id:uid},function(user){
                        user.active=active;
                        $scope.chatRoomUsers.push(user);

                        var msg={systemMessage:true}
                        msg.timestamp=new Date();
                        msg["message"]=active? chatUser.name+" has joined the chat room!":chatUser.name+" has left the chat room!"
                        $scope.chatMessages.push(msg);
                        $scope.$apply();


                    });
                }
            }
            //Retrieve all messages for given chat room, and initialize socket io connection 
            retrieveMessages($scope.currentRoom._id,function(){
                socket = io();
                socket.on('connect',function(){
                    socket.on("message",function(message){
                        console.log("new message "+message)
                        console.log(message)
                        if($scope.currentRoom._id == message.rid){
                            addMessage(message);
                        }
                    });
                    //Send Join request to server
                    socket.emit("join",{
                        rid: $scope.currentRoom._id,
                        uid: $scope.currentUser._id,
                        uname: $scope.currentUser.name
                    });

                    //get all clients currently in the chat room
                    socket.on("clientlist",function(clientList){
                        clientList.data.forEach(function(uid){
                            activeUser(uid,true);
                        })
                    });
                    socket.on("newclient",function(data){
                        var uid=data.data;
                        if(uid!== $scope.currentUser._id){
                            console.log("new Client: "+uid);
                            activeUser(uid,true);
                        }
                        
                    });
                    socket.on("clientleave",function(data){
                        var uid=data.data;
                        console.log("client left: "+uid);
                        activeUser(uid,false);
                    });
                    socket.on("chaterror",function(data){
                        console.log("chat error: "+data);
                        showErrorMessages(data);
                    });
                });
            });
            var loadingFinishCallback = (function (users){
                var counter=users.length;
                var results= [];
                return function(user){
                    user.active=false;
                    results.push(user);
                    if(--counter==0)  $scope.chatRoomUsers= $scope.chatRoomUsers.concat(results);
                };
            })($scope.currentRoom.users);
            $scope.currentRoom.users.forEach(function(uid){
                UserService.query({id:uid},loadingFinishCallback);
            });

        }

        //Loading all chat rooms for current user
        UserService.currentUser(function(data){
            $scope.currentUser=data;
            $scope.currentUser.chatRoomStatus.forEach(function(roomStatus){
                ChatRoomService.query({id:roomStatus.rid},function(room){
                    room.lastUpdate = roomStatus.lastUpdate;
                    $scope.chatRooms.push(room);
                }); 
            });  
        },function(){
            $location.path("/login");
        }); 
        function showErrorMessages(msg){
            $scope.showError=msg;
        }
    }]);