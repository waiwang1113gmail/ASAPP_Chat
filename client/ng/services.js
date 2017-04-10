var module = angular.module("services",['constants','chatResource']);
//Service for handing all authentication and possible authorization
module.factory('AuthService',['UserService', '$rootScope',function(UserService,$rootScope){
    var authService = {};
    //Try to login user with username
    //If it passes, it broadcasts 'loginSuccess' event on $rootScope
    //If it fails, it broadcasts 'loginFail' event on $rootScope
    authService.login = function(username){
        UserService.login({},{ 'name' : username},function(data){
            authService.setCurrentUser(data);
            $rootScope.$broadcast("loginSuccess");
        },function(){
            $rootScope.$broadcast("loginFail");
        }); 
    }

    //currentUser stores current login user object
    //It can be used to determine if current user is authenticated or not
    var currentUser= null;
    authService.isAuthenticated = function(){
        return !!currentUser;
    }
    authService.setCurrentUser = function(user){
        currentUser=user;
    }

    authService.getCurrentUser = function(){
        return currentUser;
    }
    return authService;
}])
//Socket Io service to handle websocket connection
.factory('SocketIOService',['$rootScope','$log',function($rootScope,$log){

    var socket;

    var socketIoService ={};

    socketIoService.init=function(){
        if(!io){
            $log.error("socket io is not found");
            $rootScope.$broadcast('chatError','failed to connect to server socket')
        }else{
            socket =io();
            socket.on('connect',function(){
                socket.on("message",function(message){
                    $log.debug("new message "+ JSON.stringify(message)); 
                    $rootScope.$broadcast('newmessage',message);
                }); 

                //get all clients currently in the chat room
                socket.on("clientlist",function(clientList){
                    $log.debug("received chat room clientList: "+ JSON.stringify(clientList)); 
                    $rootScope.$broadcast('newChatUser',clientList);
                });
                socket.on("newclient",function(client){
                    $log.debug("received chat room client joined: "+ JSON.stringify(client)); 
                    $rootScope.$broadcast('newChatUser',client);
                });
                socket.on("clientleave",function(client){
                    $log.debug("received chat room client left: "+ JSON.stringify(client)); 
                    $rootScope.$broadcast('chatUserLeave',client);
                });
                socket.on("chaterror",function(data){
                    $log.error("Socket io error"+ JSON.stringify(data)); 
                    $rootScope.$broadcast('chatError',data);
                });
            });
        }

    }
    socketIoService.joinRoom = function(chatRoom,user){
        if(!socket){
            $log.warn("Socket is not open, cannot join chat room: "+JSON.stringify(chatRoom) +" ,"+JSON.stringify(user));
        }else{
            $log.info("joining room "+ JSON.stringify(chatRoom));
            socket.emit("join",{
                rid: chatRoom._id,
                uid: user._id,
                uname: user.name
            });
        }
    }

    socketIoService.close=function(){
        $log.info("closing connection to server web socket");
        if(socket) socket.disconnect();
    }
     
}])