var app = angular.module("chatApp",['ngRoute','controllers','directives','constants']);
var BASE_URL="/api/";
//entry point controller, determiine if user have login
app
.config(['$locationProvider','$routeProvider',function($locationProvider,$routeProvider){
    $locationProvider.hashPrefix('!');
    $routeProvider.when('/login',{
        templateUrl:'views/login.html',
        controller:'loginCtrl'
    }).when('/welcome',{
        templateUrl:'views/welcome.html',
        controller:'welcomeCtrl'
    }).when('/chat_room',{
        templateUrl:'views/chat_room.html',
        controller:'chatRoomCtrl'
    }).when('/my_room',{
        templateUrl:'views/my_room.html',
        controller:'myRoomCtrl'
    }).otherwise('/welcome');
}]).run(['$rootScope',"$http","$location", function($rootScope,$http,$location){
    $rootScope.logoff = function(){
        $http.get("/logoff").then(function(response){
            $location.path("/login");
        });
    }
}]);