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
}]).controller("myRoomCtrl",["$interval","$scope",'$location','$rootScope','defaultUpdateFrequency','UserService','ChatRoomService',
    function($interval,$scope,$location,$rootScope,defaultUpdateFrequency,UserService,ChatRoomService){
        $scope.chatRooms = [];
        $scope.currentRoom = null;
        $scope.chatMessages = [];
        $scope.newMessage = "";

        //Schedule a fixed delay task that retrieves message from server for current chat room;
        var intervalPromise; 
        $scope.currentUser;

        //Cancel all schedule tasks
        function cleanUp(){ 
            $scope.showError=null;
            $scope.chatMessages = [];
            $scope.newMessage = "";
            $interval.cancel(intervalPromise);
        }
        $scope.$on("$destroy", function() { 
            cleanUp();
        });

        function addMessage(msg,author){
            msg.author=author;
            msg.sentByMe=msg.uid===$scope.currentUser._id;
            $scope.chatMessages.push(msg);
        }
        //Retrieve Messages from givem chat room, and update chat room
        //if sinceLastUpdate is set, return 
        function retrieveMessages(rid,sinceLastUpdate,callback){
            var resource = sinceLastUpdate? ChatRoomService.allMessagesSinceLastUpdate:ChatRoomService.allMessages;
            resource({id:rid},function(messages){ 
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
                    UserService.query({id:msg.uid},function(userResponse){
                        msg.sentByMe=msg.uid===$scope.currentUser._id;
                        msg.author=(msg.uid===$scope.currentUser._id)?"me":userResponse.name;
                        loadingFinishCallback(msg);
                    });     
                });
            },function(){$scope.showError="Oops, failed to fetch messages from server!"});
        }
        $scope.sendMessage=function(){ 
            ChatRoomService.newMessage(
                {id:$scope.currentRoom._id },
                { 'message' :  $scope.newMessage },
                function(){/*Clear new message input*/$scope.newMessage="";},function(){
                    $scope.showError = "Oops, failed to send new message!";
                });
        }
        $scope.selectRoom = function(room){
            if(room === $scope.currentRoom) return;

            //Cancel previous scheduled task
            cleanUp();

            //Select room to be selected and deselect other rooms
            $scope.chatRooms.forEach(function(r){r.selected=false;});
            room.selected=true;
            room.unread=null;
            $scope.currentRoom = room;
            //First time fetching messages from server, without specify laastUpdate time
            //retrieve all messages
            retrieveMessages($scope.currentRoom._id,null,function(){
                intervalPromise = $interval(function(){ 
                    retrieveMessages($scope.currentRoom._id,true);
                },defaultUpdateFrequency);
            });
        }

        //Loading all chat room for current user
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
    }]);