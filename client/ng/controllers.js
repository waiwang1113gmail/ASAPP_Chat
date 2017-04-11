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
        //Use login function in AuthService
        //And register for login events 
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
app.controller("chatRoomListCtrl",["$scope",'$location','$rootScope','ChatRoomService','UserService','$log',
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

        //TODO implements a better way to restore chat room data.
        //Current implementation just simply store all data in the repository 
        var CHAT_ROOMS_DATA = {};

        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(room){
            //if current room is selected room just return 
            if($scope.currentRoom && room._id === $scope.currentRoom._id)
                return;
            //If there the user is currently in a chat room, we need to save the chat room data
            //for later the user joins the chat room again
            if($scope.currentRoom){
                $log.info('saving chat room data from the repsotory: '+ JSON.stringify($scope.currentRoom));
                var roomData = {};
                roomData.chatMessages=$scope.chatMessages;
                roomData.newMessage=$scope.newMessage ;
                CHAT_ROOMS_DATA[$scope.currentRoom._id]=roomData;
            }
            //The chat room has been visited, restore the data from the repository.
            if(CHAT_ROOMS_DATA[room._id]){
                $log.info('restoring chat room data from the repsotory: '+ JSON.stringify(room));
                $scope.chatMessages=CHAT_ROOMS_DATA[room._id].chatMessaes;
                $scope.newMessage=CHAT_ROOMS_DATA[room._id].newMessage;
            }
                

            $scope.currentRoom = room;
            $log.info('Select room: '+JSON.stringify(room));

            //fectch all messages for the chat room since last update
            //Even after restoring messages data from the repository, since the chat room
            //stops receiving messages from server after it is saved to the repository.
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
        //Add a new system message to chat room
        function systemMessage(msg){
            $log.debug("new system message: "+ JSON.stringify(msg));
            var msg={systemMessage:true}
            msg.timestamp=new Date();
            $scope.chatMessages.push(msg);
        }
        var newClientListenerDeregister=$rootScope.$on('newChatUser',function(data){
            $log.debug("new chat client: "+JSON.stringify(data));
            if(data.rid==$scope.currentRoom._id){ 
                if(!Array.isArray(data.data)){
                    data.data = [data.data]; 
                }
                data.data.forEach(function(user){
                    systemMessage(user.name+" has joined the chat room!");
                });
            }else{
                $log.warn("Received client data for different chat room");
            }
        });
        var clientLeaveListenerDeregister=$rootScope.$on('chatUserLeave',function(data){
            $log.debug("client left room: "+JSON.stringify(data));
            if(data.rid==$scope.currentRoom._id){ 
                systemMessage(data.data.name+" has joined the chat room!");
            }else{
                $log.warn("Received client data for different chat room");
            }
        });
        var newMessageListenerDeregister=$rootScope.$on('newmessage',function(data){
            $log.trace("client left room: "+JSON.stringify(data));
            var msg=data.data;
            msg.timestamp=new Date(msg.timestamp);
            UserService.getUser(msg.uid,function(user,error){
                if(error){
                    $log.error("ERROR: retrieve user data for: "+JSON.stringify(msg.uid));
                    $rootScope.$broadcast('chatError',"Oops, failed to get user info");
                }else{
                    msg.sentByMe=msg.uid===currentUser._id;
                    msg.author=(msg.uid===currentUser._id)?"me":userResponse.name;
                    $scope.chatMessages.push(msg);
                }
            });
            UserService.lastUpdate({rid:msg.rid},{"timestamp":msg.timestamp},function(){
                $log.info("update timestamp successfully");
            },function(){
                $log.error("failed to update timestamp");
            })
        });

        $scope.$on("$destroy", function() { 
            roomSelectionDeregister();
            newClientListenerDeregister();
            clientLeaveListenerDeregister();
            newMessageListenerDeregister();
            $log.info('chatRoomCtrl is destroyed');
            SocketIOService.close();
        });
    }]);