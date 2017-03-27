var app = angular.module("controllers",[]);
app.controller("loginCtrl",["$http","$scope",'$location','$rootScope',function($http,$scope,$location,$rootScope){
    $http.get(BASE_URL + "user")
        .then(function(response){
            $rootScope.currentUser=response.data;
            $location.path( "/chat_room" );   
        });
    $scope.name="";
    $scope.showError=false;
    $scope.login=function(){
        $http({
            url: BASE_URL + "login",
            method: "POST",
            data: { 'name' : $scope.name }
        }).then(function(){
            $location.path( "/chat_room" );  
        },function(){ 
            $scope.showError = true;
        });
    }
}]).controller("chatRoomCtrl",["$http","$scope",'$location','$rootScope',function($http,$scope,$location,$rootScope){
    $scope.chatRooms = [];
    $scope.join = function(room){
        $http({
            url: BASE_URL + "room/join",
            method: "POST",
            data: { 'room' : room._id }
        }).then(function(){
            $location.path( "/my_room" );  
        },function(){ 
            $scope.showError = true;
        });
    }
    var currentUser =$rootScope.currentUser;
    if(!currentUser){
        $location.path("/login");
    }else{
        $http.get(BASE_URL + "rooms").then(function(response){
            response.data.forEach(function(room){
                $rootScope.currentUser.chatRoomStatus.forEach(function(roomStatus){
                    if(roomStatus.rid==room._id){
                        room.alreadyJoined=true;
                    }else{
                        room.alreadyJoined=false;
                    }
                });
            });
            $scope.chatRooms = response.data; 
        });
    }
}]).controller("myRoomCtrl",["$http","$scope",'$location','$rootScope',function($http,$scope,$location,$rootScope){
    var currentUser =$rootScope.currentUser;
    $scope.chatRooms = [];
    if(!currentUser){
        $location.path("/login");
    }else{
        //Retrieve chat room data from server and add to the list
        currentUser.chatRoomStatus.forEach(function(roomStatus){
            $http.get(BASE_URL + "room/"+roomStatus.rid).then(function(response){
                var room = response.data;
                room.lastUpdate = roomStatus.lastUpdate;
                $scope.chatRooms.push(room);
            });
        });
    }
}]);