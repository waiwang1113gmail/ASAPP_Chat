var module = angular.module("directives",[]);
module.directive('scrollToEnd',['$timeout',function($timeout){
    return function($scope,$element,attrs){
        if($scope.$last){
            console.log($scope.$last);
            console.log($element.parent());
            $timeout(function(){
                var container=$element.parent();
                container.animate({ scrollTop: container.prop("scrollHeight")}, 1000);
            },0);
        }
    }
}]);