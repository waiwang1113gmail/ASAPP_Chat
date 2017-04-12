//Controllers module contains all controllers used in the chat room application
//The design is emphasizing to split features into smaller and more manageable components.
//Moreover minimizing the dependency between the controllers was also considered 
//when implementing the controllers. 

//All Controllers are communicating using subscribe publish pattern.
//Following list contains all controllers and events they substribe and publish
/*
    mainCtrl                - Application controller, parent of all other controllers. it is responsible managing
                            session data

    errorMessageController  - controller for managing error by listening to error event propagated from other controller

    loginCtrl               - It doesn't handling login directly, instead it forwards the request to AuthService, and 
                              listen to the login result events.
    
    chatRoomListCtrl        - it is responsible for listing all chat room, and also contains a function to add a new chat room

    myChatRoomListCtrl      - Controller to list all chat room for current login user.

    chatRoomUserListCtrl    - List all active and inactive chat room users 

    chatRoomCtrl            - Managing the chat room. when it is initialized with a chat room, chatRoomCtrl would try to download
                              all messages for giving controller since the current user's last update on the current chat room. Next it
                              updates the current user's last update field on the current chat room to the latest message's timestamp. Every time
                              it receives a new message, it also updates the last update field. Moreover, when a chat room user becomes active or
                              inactive, it also generates a system message for it.

    _____________________________________________________________________________________________________________________________________________
    Controller Name          |   subscribe                                               
    _____________________________________________________________________________________________________________________________________________
    mainCtrl                 |   restoreSessionSuccess - when browser is reloaded or the chat application, it will try to restore the previous 
                                                         login session. When this event is received, it would try to redirect the page to chat 
                                                         room list page if currently in login page 
                                 restoreSessionFailure - when browser is reloaded or the chat application, it will try to restore the previous 
                                                         login session. When this event is received, it would try to redirect the page to  
                                                         login page 
                                 refresh               - Try to reload user data from server, would fire restoreSessionSuccess or 
                                                         restoreSessionFailure depends on the result
    
    
    _____________________________________________________________________________________________________________________________________________
    
    errorMessageController   |   chatError             - receives all chat error, and try to display it                                     
    _____________________________________________________________________________________________________________________________________________
    
    loginCtrl                |   loginSuccess          - login success       
                                 loginFail             - login fail                                          
    _____________________________________________________________________________________________________________________________________________
    
    chatRoomListCtrl         |                                            
    _____________________________________________________________________________________________________________________________________________
    
    myChatRoomListCtrl       |   roomSelection         - register this event, for chat room change. if a new chat room is selected, it need to 
                                                         update its state of all chat room.
                                 restoreSessionSuccess - user data has been updated , need to update the chat room list                                              
    _____________________________________________________________________________________________________________________________________________
    
    chatRoomUserListCtrl     |   roomSelection         - register this event, for chat room change. if a new chat room is selected, it need to 
                                                         update all chat room user data
                                 newChatUser           - a user becomes active in current chat room
                                 chatUserLeave         - a user becomes inactive in current chat room                                      
    _____________________________________________________________________________________________________________________________________________
    
    chatRoomCtrl             |   newChatUser           - a user becomes active in current chat room
                                 chatUserLeave         - a user becomes inactive in current chat room   
                                 newmessage            - a new chat room message is avialbe
                                                                            
*/



var app = angular.module("controllers",['constants','chatResource','services']);
//Application level controller, the parent of all other controllers
//It is responsible to redirect to the right location depends on user's state. 
//e.g. if the user is not authenticated, redirect them to login page

app.controller("mainCtrl",["AuthService","$scope",'$location','AuthService','$rootScope','UserService','$log',function(AuthService,$scope,$location,AuthService,$rootScope,UserService,$log){
   $scope.currentUser;
   
   $rootScope.$on('restoreSessionSuccess',function(){
       $log.debug("restoreSessionSuccess event" );
        if($location.url()==="/login")
            $location.path( "/chat_room" );  
   });
   $rootScope.$on('restoreSessionFailure',function(){
       $log.debug("restoreSessionFailure event" );
       $location.path( "/login" );  
   });
   $rootScope.$on('refresh',function(){
       UserService.currentUser(function(data){
            $log.debug("Restoring user data successfully: "+JSON.stringify(data));
            AuthService.setCurrentUser(data);
            $scope.currentUser=data;
            $rootScope.$broadcast('restoreSessionSuccess');
        },function(){
            $log.debug("User is not authenticated");
            $rootScope.$broadcast('restoreSessionFailure');
        })
   });
   $rootScope.$broadcast('refresh');
}]);

//Controller for handing application error
app.controller("errorMessageController",["$scope",'$rootScope','$log',function($scope,$rootScope,$log){
    $scope.errorMsg="";
    
    var chatErrorDeregister=$rootScope.$on('chatError',function(event,msg){
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
app.controller("chatRoomListCtrl",["$scope",'$location','$rootScope','ChatRoomService','UserService','AuthService','$log',
    function($scope,$location,$rootScope,ChatRoomService,UserService,AuthService,$log){
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
             AuthService.getCurrentUser().chatRoomStatus.forEach(function(roomStatus){
        
                myRooms[roomStatus.rid]=true;
             }) 
            rooms.forEach(function(room){  
                room.alreadyJoined=myRooms[room._id]
                $scope.chatRooms.push(room);
            });
        },function(err){
            $log.error('ERROR: Received chat rooms data: '+JSON.stringify(err));
            $rootScope.$broadcast('chatError',"Oops, failed to creat new chat room!");
        });
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
        var deregister = $rootScope.$on('restoreSessionSuccess',function(){
            //fectch all joined chat rooms data from server
            $log.debug('downloading all joined chat rooms data');
            AuthService.getCurrentUser().chatRoomStatus.forEach(function(chatRoom){
                ChatRoomService.query({id:chatRoom.rid},function(room){
                    room.lastUpdate = chatRoom.lastUpdate;
                    $scope.myChatRoomList.push(room);
                });
            });
        });
        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(event,room){
            $scope.myChatRoomList.forEach(function(r){
                r.selected=r._id===room._id;
            })
        });
        //we need to fire refresh event in order to load or reload all
        //chat room data
        if(AuthService.getCurrentUser()){
            $rootScope.$broadcast('refresh');
        }
        $scope.$on("$destroy", function() { 
            $log.info('myChatRoomListCtrl is destroyed');
            deregister();
            roomSelectionDeregister();
        });
}]);

//controller for listing all users in a given chat room
app.controller("chatRoomUserListCtrl",["$scope",'$rootScope','ChatRoomService','AuthService','UserService','$log',
    function($scope,$rootScope,ChatRoomService,AuthService,UserService,$log){
        $scope.chatRoomUsers = [];
        
        //Register listener for 'roomSelection' event
        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(event,chatRoom){
            $log.info('chat room is selected: '+ JSON.stringify(chatRoom));
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
            })(chatRoom.users);
            chatRoom.users.forEach(function(uid){
                UserService.query({id:uid},loadingFinishCallback);
            });
        }); 
        //Register for event fired when a new user joins the chat room 
        var newClientListenerDeregister=$rootScope.$on('newChatUser',function(event,data){
            $log.debug("Client list: new chat client: "+JSON.stringify(data));
            if(!Array.isArray(data.data)){
                data.data = [data.data]; 
            }
            var newAcitiveUsers={};
            data.data.forEach(function(uid){
                newAcitiveUsers[uid]=true;
            });
            console.log(newAcitiveUsers);
            $scope.chatRoomUsers.forEach(function(user){ 
                if(newAcitiveUsers[user._id]){
                    user.active=true; 
                } 
            });
            $scope.$apply();
        });
        var clientLeaveListenerDeregister=$rootScope.$on('chatUserLeave',function(event,data){
             $log.debug("Client list: a chat client left: "+JSON.stringify(data));
             $scope.chatRoomUsers.forEach(function(user){ 
                 if(user._id===data.data)
                    user.active=false;
            });
            $scope.$apply();
        })
        $scope.$on("$destroy", function() { 
            $log.info('chatRoomUserListCtrl is destroyed');
            roomSelectionDeregister();
            newClientListenerDeregister();
            clientLeaveListenerDeregister();
        });
}]);
app.controller("chatRoomCtrl",["$scope",'$rootScope','UserService','ChatRoomService','AuthService','SocketIOService','$log',
    function($scope,$rootScope,UserService,ChatRoomService,AuthService,SocketIOService,$log){
        $scope.currentRoom = null;
        //Chat messages for selected chat room
        $scope.chatMessages = [];
        $scope.newMessage = "";
        var currentUser = AuthService.getCurrentUser();

        $scope.sendMessage=function(newMessage){
            $log.debug('sedning new message: '+newMessage)
            SocketIOService.newMessage($scope.currentRoom._id,newMessage)
            $scope.newMessage="";
        }


        //TODO implements a better way to restore chat room data.
        //Current implementation just simply store all data in the repository 
        var CHAT_ROOMS_DATA = {};

        var roomSelectionDeregister=$rootScope.$on('roomSelection',function(event,room){
            currentUser = AuthService.getCurrentUser();
            //if current room is selected room just return 
            if($scope.currentRoom && room._id === $scope.currentRoom._id)
                return;
            //If there the user is currently in a chat room, we need to save the chat room data
            //for later the user joins the chat room again
            if($scope.currentRoom){
                $log.info('saving chat room data to the repsotory: '+ JSON.stringify($scope.currentRoom));
                var roomData = {};
                roomData.chatMessages=$scope.chatMessages;
                roomData.newMessage=$scope.newMessage ;
                $scope.chatMessages = []; 
                CHAT_ROOMS_DATA[$scope.currentRoom._id]=roomData;
            }
            //The chat room has been visited, restore the data from the repository.
            if(CHAT_ROOMS_DATA[room._id]){
                $log.info('restoring chat room data from the repsotory: '+ JSON.stringify(room));
                $scope.chatMessages= $scope.chatMessages.concat(CHAT_ROOMS_DATA[room._id].chatMessages);
                console.log(CHAT_ROOMS_DATA[room._id].chatMessages);
                $scope.newMessage=CHAT_ROOMS_DATA[room._id].newMessage;
                delete CHAT_ROOMS_DATA[room._id];
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
                    var latestMessage=new Date(0);
                    return function(msg){
                        if(msg.timestamp >latestMessage.timestamp) latestMessage=msg;
                        results.push(msg);
                        if(--counter==0){
                            //all messages are loaded
                            $scope.chatMessages= $scope.chatMessages.concat(results);
                            $scope.$apply();
                            //update the lastupdate field using the timestamp of the latest message
                             updateLastUpdate(room._id,msg.timestamp)
                        } 
                    };
                })(messages);
                messages.forEach(function(msg){
                    msg.timestamp=new Date(msg.timestamp);
                    UserService.getUser(msg.uid,function(user,error){
                        if(error){
                            $log.error("ERROR: retrieve user data for: "+JSON.stringify(msg.uid));
                            $rootScope.$broadcast('chatError',"Oops, failed to get user info");
                        }else{
                            $log.debug("get user data "+ JSON.stringify(user));
                            msg.sentByMe=msg.uid===currentUser._id;
                            msg.author=(msg.uid===currentUser._id)?"me":user.name;
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
        function systemMessage(message){
            $log.debug("new system message: "+ JSON.stringify(message));
            var msg={systemMessage:true}
            msg.timestamp=new Date();
            msg.message=message;
            $scope.chatMessages.push(msg);
        }
        //Update the chatroomstatus of auser
        function updateLastUpdate(rid,timestamp){
            UserService.lastUpdate({rid:rid},{"timestamp":timestamp},function(){
                $log.info("update timestamp successfully");
            },function(){
                $log.error("failed to update timestamp");
            });
        }
        //Register for event fired when a new user joins the chat room
        //And print a system message to chat room
        var newClientListenerDeregister=$rootScope.$on('newChatUser',function(event,data){
            $log.debug("new chat client: "+JSON.stringify(data));
            if(data.rid==$scope.currentRoom._id){ 
                if(!Array.isArray(data.data)){
                    data.data = [data.data]; 
                }
                data.data.forEach(function(uid){
                    if(uid !==AuthService.getCurrentUser()._id)
                        UserService.getUser(uid,function(user,error){
                            if(error){
                                $log.error("ERROR: retrieve user data for: "+JSON.stringify(msg.uid));
                                $rootScope.$broadcast('chatError',"Oops, failed to get user info");
                            }else{
                                $log.debug("get user data "+ JSON.stringify(user));
                                systemMessage(user.name+" has joined the chat room!");
                            }
                        });
                });
            }else{
                $log.warn("Received client data for different chat room");
            }
        });
        var clientLeaveListenerDeregister=$rootScope.$on('chatUserLeave',function(event,data){
            $log.debug("client left room: "+JSON.stringify(data));
            if(data.rid==$scope.currentRoom._id){ 
                 UserService.getUser(data.data,function(user,error){
                    if(error){
                        $log.error("ERROR: retrieve user data for: "+JSON.stringify(msg.uid));
                        $rootScope.$broadcast('chatError',"Oops, failed to get user info");
                    }else{
                        $log.debug("get user data "+ JSON.stringify(user));
                        systemMessage(user.name+" has left the chat room!");
                    }
                }); 
            }else{
                $log.warn("Received client data for different chat room");
            }
        });
        var newMessageListenerDeregister=$rootScope.$on('newmessage',function(event,data){
            $log.debug('new message: '+JSON.stringify(data));
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
            //change lastUpdate to prevent receiving again 
            updateLastUpdate(msg.rid,msg.timestamp);
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