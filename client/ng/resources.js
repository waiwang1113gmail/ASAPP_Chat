angular
    .module('chatResource', ['ngResource','constants'])
    .factory('UserService', ['$resource','baseUrl',function($resource,baseUrl){


        return $resource(baseUrl+'/user/:id',{},{
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
            },unreadMessages:{
                url: baseUrl+'/user/unread/messages',
                method: 'GET',
                isArray:true
            }
        });
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
                url: baseUrl+'/room/:id/messagesSinceLastupdate',
                method: 'GET',
                isArray:true
            }
        });
    }])