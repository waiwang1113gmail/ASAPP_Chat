var app = angular.module("controllers",['constants','chatResource','services']);
//Try to restore user session if the user was authenticated
//it runs every time user is refreshing the browser.

app.run(['AuthService','$rootScope','UserService','$log',function(AuthService,$rootScope,UserService,$log){
    UserService.currentUser(function(data){
        $log.debug("Restoring user data successfully: "+JSON.stringify(data));
        UserService.setCurrentUser(data);
    },function(){
        $log.debug("User is not authenticated");
    })
}]);

//Application level controller, the parent of all other controllers
//It is responsible to redirect to the right location depends on user's state. 
//e.g. if the user is not authenticated, redirect them to login page
app.controller("mainCtrl",["$scope",'$location','AuthService','$log',function($scope,$location,AuthService,$log){
    if(!AuthService.isAuthenticated){
        $log.debug('The user is not authenticated, redirect to login page');
        $location.path( "/login" );  
    }else{
        $log.debug('The user has been authenticated');
    }
}]);

//Controller for handing application error
app.controller("errorMessageController",["$scope",'$rootScope','$log',function($scope,$rootScope,$log){
    $scope.errorMsg="";
    
    var chatErrorDeregister=$rootScope.$on('chatError',function(msg){
        $log.info('new error message: '+msg);
        $scope.errorMsg=msg;
    });
    $scope.$on("$destroy", function() { 
        $log.info('errorMessageController is destroyed');
        chatErrorDeregister(); 
    });
}]);

//Login controller that handle login
app.controller("loginCtrl",["$scope",'$location','$rootScope','AuthService','$log',
    function($scope,$location,$rootScope,AuthService,$log){
        $scope.name="";
        $scope.login=AuthService.login;
        var loginSuccessDeregister= $rootScope.$on('loginSuccess',function(){
            $log.debug('login succeed');
            $location.path( "/chat_room" );  
        });

        var loginFailDeregister=$rootScope.$on('loginFail',function(){
            $log.debug('login failed');
            $rootScope.$broadcast('chatError',"Login failed");
        });
        $scope.$on("$destroy", function() { 
            $log.info('loginCtrl is destroyed');
            loginSuccessDeregister();
            loginFailDeregister();
        });
}]);

//Controller for listing all chat rooms available
app.controller("chatRoomCtrl",["$scope",'$location','$rootScope','ChatRoomService','UserService','$log',
    function($scope,$location,$rootScope,ChatRoomService,UserService,$log){
        $scope.chatRooms = [];
        $scope.newRoomName="";

        $scope.join = function(room){
            $log.info('Joining chat room: '+JSON.stringify(room));
            ChatRoomService.joinRoom({}, { 'room' : room._id },function(){
                $location.path( "/my_room" );  
            },function(err){
                $log.error('ERROR: Joining chat room: '+JSON.stringify(err));
                $rootScope.$broadcast('chatError',"Oops, failed to join the chat room!");
            });
        }
       
        $scope.createRoom = function(newRoom){
            $log.info('creating chat room: '+JSON.stringify(newRoom));
            ChatRoomService.newRoom({},{ 'name' : newRoom },function(){
                $location.path( "/my_room" );
            },function(err){
                $log.error('ERROR: creating chat room: '+JSON.stringify(err));
                $rootScope.$broadcast('chatError',"Oops, failed to creat new chat room!");
            });
        } 
        //Initialize chat room list by retrieving all chat rooms from server
        ChatRoomService.allRoom(function(rooms){
             $log.debug('Received chat rooms data: '+JSON.stringify(rooms));
            //Get a map of all chat rooms the current user has joined
             var myRooms = {};
             $scope.currentUser.chatRoomStatus.forEach(function(roomStatus){
                myRooms[roomStatus.rid]==true;
             })
            rooms.forEach(function(room){ 
                room.alreadyJoined=myRooms[room._id]
                $scope.chatRooms.push(room);
            });
        },function(err){
            $log.error('ERROR: Received chat rooms data: '+JSON.stringify(err));
            $rootScope.$broadcast('chatError',"Oops, failed to creat new chat room!");
        })
}]);

//Controller for listing all chat rooms the current user has joined
//When this controller is initialized, it tries to download all chat room data 
//the current user has joined, and it also provides a function that broadcase when a chat
//room is selected
app.controller("myChatRoomListCtrl",["$scope",'$rootScope','ChatRoomService','AuthService','$log',
    function($scope,$rootScope,ChatRoomService,AuthService,$log){
        $scope.myChatRoomList = [];
        //Function to broadcast room selection event
        $scope.selectRoom = function(room){
            $log.debug('select room: '+JSON.stringify(room));
            $rootScope.$broadcast('roomSelection',room);
        }
        //fectch all joined chat rooms data from server
        $log.debug('downloading all joined chat rooms data');
        AuthService.getCurrentuser().chatRoomStatus.forEach(function(chatRoom){
            ChatRoomService.query({id:chatRoom.rid},function(room){
                room.lastUpdate = chatRoom.lastUpdate;
                $scope.myChatRoomList.push(room);
            });
        });
}]);

//controller for listing all users in a given chat room
app.controller("chatRoomUserListCtrl",["$scope",'$rootScope','ChatRoomService','AuthService','$log',
    function($scope,$rootScope,ChatRoomService,AuthService,$log){
        $scope.chatRoomUsers = [];

        //Register listener for 'roomSelection' event
        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(chatRoom){
            $log.info('a chat room is selected: '+ JSON.stringify(chatRoom));
            //function to load users data for chat room
            //It is used to prevent updating $scope.chatRoomUsers too many times
            var loadingFinishCallback = (function (users){
                var counter=users.length;
                var results= [];
                return function(user){
                    user.active=false;
                    results.push(user);
                    if(--counter==0)  $scope.chatRoomUsers = results;
                };
            })($scope.chatRoom.users);
            $scope.chatRoom.users.forEach(function(uid){
                UserService.query({id:uid},loadingFinishCallback);
            });
        });

       //Register listener for 'userStatusChange' event
       var userStatusChangeDeregister= $rootScope.$on('userStatusChange',function(event){
           $log.debug('userStatusChange event: '+ JSON.stringify(event));
           $scope.chatRoomUsers.forEach(function(chatUser){
                if(chatUser._id===event.uid){
                    chatUser.active=event.active; 
                }

            });
        })

        $scope.$on("$destroy", function() { 
            $log.info('chatRoomUserListCtrl is destroyed');
            roomSelectionDeregister();
            userStatusChangeDeregister();
        });
}]);
app.controller("chatRoomCtrl",["$scope",'$rootScope','UserService','ChatRoomService','AuthService','SocketIOService','$log',
    function($scope,$rootScope,UserService,ChatRoomService,AuthService,SocketIOService,$log){
        $scope.currentRoom = null;
        //Chat messages for selected chat room
        $scope.chatMessages = [];
        $scope.newMessage = "";
        var currentUser = AuthService.getCurrentuser();
        var deregisters =[];
        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(room){
            $scope.currentRoom = room;
            $log.info('Select room: '+JSON.stringify(room));
            ChatRoomService.allMessagesSinceLastUpdate({ id: room._id },function(messages){ 
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
                    UserService.getUser(msg.uid,function(user,error){
                        if(error){
                            $log.error("ERROR: retrieve user data for: "+JSON.stringify(msg.uid));
                            $rootScope.$broadcast('chatError',"Oops, failed to get user info");
                        }else{
                            msg.sentByMe=msg.uid===currentUser._id;
                            msg.author=(msg.uid===currentUser._id)?"me":userResponse.name;
                            loadingFinishCallback(msg);
                        }
                    })    
                });
                SocketIOService.init();
                SocketIOService.joinRoom(room,currentUser);
            },function(err){
                $log.error("ERROR: to retrieve messages: "+JSON.stringify(room));
                $log.error(JSON.stringify(err));
                $rootScope.$broadcast('chatError',"Oops, failed to retrieve messages");
            });
        });
        deregisters.push(roomSelectionDeregister);
        $scope.$on("$destroy", function() { 
            $log.info('chatRoomCtrl is destroyed');
            SocketIOService.close();
        });
    }]);
app.controller("myRoomCtrl",["$scope",'$location','$rootScope','defaultUpdateFrequency','UserService','ChatRoomService',
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
                    }

                });
                $scope.$apply();
                //New client so we need to update our chat room clientlist
                if(!found){
                    UserService.query({id:uid},function(user){
                        user.active=active;
                        $scope.chatRoomUsers.push(user);

                        var msg={systemMessage:true}
                        msg.timestamp=new Date();
                        msg["message"]=active? user.name+" has joined the chat room!":user.name+" has left the chat room!"
                        $scope.chatMessages.push(msg);
                     
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