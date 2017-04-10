angular
    .module('chatResource', ['ngResource','constants'])
    .factory('UserService', ['$resource','baseUrl',function($resource,baseUrl){

        
        var obj = $resource(baseUrl+'/user/:id',{},{
            query:{
                url:baseUrl+'/user/:id',
                method:'GET', 
                isArray:false
            },
            currentUser:{
                url:baseUrl+'/user',
                method:'GET', 
                isArray:false
            },
            login:{
                url:baseUrl+'/login',
                method:'post', 
                isArray:false
            },lastUpdate:{
                url: baseUrl+'/user/room/:rid/lastupdate',
                method: 'post',
                isArray:false
            }
        });
        var users={};
        //To avoid requiring the same user multiple times
        //We use a simple cache to store user data has been retrieved;
        obj.getUser=function(uid,callback){
            if(users[uid]){
                callback(users[uid]);
            }else{
                obj.query({id:msg.uid},function(userResponse){
                    users[uid]=userResponse;
                    callback(userResponse);
                },function(error){
                    callback(null,error);
                });
            }
        }
        return obj;
    }]).factory('ChatRoomService', ['$resource','baseUrl',function($resource,baseUrl){

        return $resource(baseUrl+'/room/:id',{},{
            query:{
                method:'GET', 
                isArray:false
            },newRoom:{
                url:baseUrl+'/room/create',
                method:'POST'
            },joinRoom:{
                url:baseUrl+'/room/join',
                method:'POST'
            },
            allRoom:{
                url:baseUrl+'/rooms',
                method:'GET', 
                isArray:true
            },newMessage:{
                url:baseUrl+'/room/:id/newmessage',
                method:'POST'
            },allMessages:{
                url: baseUrl+'/room/:id/messages',
                method: 'GET',
                isArray:true
            },allMessagesSinceLastUpdate:{
                url: baseUrl+'/room/:id/messages',
                method: 'GET',
                isArray:true
            }
        });
    }])