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
        templateUrl:'views/welcome.html'
    }).when('/chat_room',{
        templateUrl:'views/chat_room.html',
        controller:'chatRoomListCtrl'
    }).when('/my_room',{
        templateUrl:'views/my_room.html'
    }).otherwise('/welcome');
}]).run(['$rootScope',"$http","$location", function($rootScope,$http,$location){
    $rootScope.logoff = function(){
        $http.get("/logoff").then(function(response){
            $location.path("/login");
        });
    }
}]).filter('unique',function(){
    return function(collections, attr){
        var keys=[],outputs=[];
        angular.forEach(collections,function(o){
            var key=o[attr];
            if(keys.indexOf(key)>=0){
                keys.push(key);
                outputs.push(o);
            } 
        });
        return outputs;

    }
});