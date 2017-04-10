var module = angular.module("services",['constants','chatResource']);
module.factory('AuthService',['UserService','$scope','$rootScope',function(UserService,$scope){
    var authService = {};
    authService.login = function(username){
        UserService.login({},{ 'name' : username},function(){
            $rootScope.$broadcast("loginFail");
        },function(){
            $rootScope.$broadcast("loginSuccess");
        }); 
    }
}])