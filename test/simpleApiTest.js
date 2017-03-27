process.env.NODE_ENV ="TESTING";
var config = require('../configs/config');
var should = require('should');
var request = require('request');
var expect = require("chai").expect;
var baseUrl = "http://localhost:"+config.port+"/api/";
var util = require('util');
var mongojs = require('mongojs');
var db = mongojs(config.db
            ,['message','chat_room','user']);
function setupDB(done){
    var counter=(function(done){
        var count =3;
        function f(){ 
            done();
        }
        return function(){
            if(--count==0){ 
                f();
            }
        }
    })(done);
    db.message.remove(counter);
    db.chat_room.remove(counter);
    db.user.remove(counter);
}
const TEST_USER1="test1";
const TEST_USER2="test2";
const TEST_ROOM1="Test Room";
var server = require('../server');
const USER_ENDPOINTS = {
    login : baseUrl+'login',
    user : baseUrl+'user'
}
const ROOM_ENDPOINTS = {
    create: baseUrl+'room/create',
    rooms: baseUrl+'rooms',
    room: baseUrl+'room/@id',
    join: baseUrl+'room/join',
    leave: baseUrl+'room/leave'
};
function login(options,callback){
    request.post({url:USER_ENDPOINTS.login, form: {name:options.name},jar:options.jar},function(err,httpResponse,body){
        var responseJson = JSON.parse(body); 
        expect(httpResponse.statusCode).to.equal(200);
        expect(responseJson.name).to.equal(options.name);
        callback();
    });
}
describe('login tests',function(){
    var cookieJar;
    before(function(done){
        cookieJar = request.jar();
        setupDB(done);
    }); 
    it('negative: hit user endpoint without authentication',function(done){
        request.get({url:USER_ENDPOINTS.user,jar:cookieJar},function(err,httpResponse,body){
            var responseJson = JSON.parse(body);
            expect(httpResponse.statusCode).to.equal(401);
            done();
        });
    });
     
    it('login function',function(done){
        login({name:TEST_USER1,jar:cookieJar},function(){ 
            done();
        })
    });

    it('after register',function(done){
        request.get({url: USER_ENDPOINTS.user,jar:cookieJar},function(err,httpResponse,body){
            var responseJson = JSON.parse(body);
            expect(httpResponse.statusCode).to.equal(200);
            expect(responseJson.name).to.equal(TEST_USER1);
            done();
        })
    });
});
/**
 * Test All chat room api endpoints 
 * 
 */
describe('chat room tests',function(){
    var cookieJar;
    var cookieJar2;
    before(function(done){
        cookieJar = request.jar();
        cookieJar2 = request.jar(); 
        setupDB(done); 
    }); 
    it('create chat room',function(done){
        login({name:TEST_USER2,jar:cookieJar},function(){ 
            request.post({
                url:ROOM_ENDPOINTS.create,
                jar:cookieJar,
                form: {
                    name:TEST_ROOM1
                }
            },function(err,httpResponse,body){
                expect(httpResponse.statusCode).to.equal(200);
                var responseJson = JSON.parse(body);
                expect(responseJson.name).to.equal(TEST_ROOM1);
                request.get({
                    url: ROOM_ENDPOINTS.room.replace("@id", responseJson._id),
                    jar:cookieJar
                },function(err,httpResponse,body){
                    expect(httpResponse.statusCode).to.equal(200);
                    done();
                })

            }); 
        });
    });
    it('join and leave chat room test',function(done){
        login({name:TEST_USER1,jar:cookieJar2},function(){ 
            request.get({
                url: ROOM_ENDPOINTS.rooms,
                jar:cookieJar2
            },function(err,httpResponse,body){
                expect(httpResponse.statusCode).to.equal(200);
                var responseJson = JSON.parse(body);
                expect(responseJson.length).to.equal(1);
                var charRoomId=responseJson[0]._id;
                request.post({
                    url:ROOM_ENDPOINTS.join,
                    jar:cookieJar2,
                    form: {
                        room:charRoomId
                    }
                },function(err,httpResponse,body){
                    expect(httpResponse.statusCode).to.equal(200);
                    request.get({
                        url:USER_ENDPOINTS.user,
                        jar:cookieJar2
                    },function(err,httpResponse,body){
                        expect(httpResponse.statusCode).to.equal(200);
                        var responseJson = JSON.parse(body);
                        expect(responseJson.chatRoomStatus.length).to.equal(1);
                        request.post({
                            url:ROOM_ENDPOINTS.leave,
                            jar:cookieJar2,
                            form: {
                                room:charRoomId
                            }
                        },function(err,httpResponse,body){
                            expect(httpResponse.statusCode).to.equal(200);
                            request.get({
                                url:USER_ENDPOINTS.user,
                                jar:cookieJar2
                            },function(err,httpResponse,body){
                                expect(httpResponse.statusCode).to.equal(200);
                                var responseJson = JSON.parse(body);
                                expect(responseJson.chatRoomStatus.length).to.equal(0);
                                done();
                            });
                        });
                    })
                    

                });
            })
        });
    });
});

 