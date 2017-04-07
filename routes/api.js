var express = require('express');
var config = require('../configs/config');
var router = express.Router(); 
var responses = require('../modules/response');
var entities = require('../modules/entities');
var db = require('../db/db');


var BadRequest = responses.BadRequest; 
var ServerError = responses.ServerError; 
var NoteFoundError = responses.NoteFoundError;
var UpdateOperationResponse = responses.UpdateOperationResponse;



var cookieProperties = { 
    "httpOnly":true,
    expires: new Date(Date.now() + config.sessionLength)
};
//Create a mongodb callback function that returns data from mongodb
function SimpleMongoDbCallback(res,next){
    return function(error,obj){
        if(error){
            next(new ServerError(error));
        }else if(!obj){
            next(new NoteFoundError(obj));
        }
        else{ 
            res.json(obj);
        }
    }
};
//////////////////////////////////////////////////////////////////////////////////////
//Utility functions
//////////////////////////////////////////////////////////////////////////////////////

//To excute a sequence of functions and aggregate the results.
//It takes a list of functions and a callback function.
//After all functions are executed, the results are gathered and passed 
//to the callback function.
function chainedFunctionsCall(){
    console.log("Invoke chained functions calls: "+arguments.length);
    if(arguments.length<2){
        throw new Error("this function takes at least two aguments");
    }

    var funcs = Array.from(arguments);
    var callback = funcs.splice(-1)[0];
    var proxyFunction = (function(){
        var errors=[];
        var results = []; 
        return function(error,result){
            errors.push(error);
            results.push(result);
            if(error){ 
                callback(arguments.callee,true,errors,results);
            }else if(arguments.callee.error){
                callback(arguments.callee,arguments.callee.error,errors,results);
            }else if(funcs.length===0){
                callback(arguments.callee,false,errors,results);
            }else{ 
                funcs.shift()(arguments.callee,result);
            }
        }

    })();
    funcs.shift()(proxyFunction);
}


//////////////////////////////////////////////////////////////////////////////////////
//User API
//////////////////////////////////////////////////////////////////////////////////////

//Create new user
router.post('/login',function(req,res,next){
    var newUser = req.body;
    if(!newUser.name || newUser.name.length==0){
        next(new BadRequest("Bad Request: user must have a name."));
    }else{
        db.findUser(newUser.name,function(error,user){
            if(error){
                next(new ServerError(error));
            }
            if(user){
                res.cookie("uid",user._id,cookieProperties);
                res.json(user);
            }else{
                newUser = new entities.User(newUser.name);
                db.addUser(newUser,function(error,user){
                    if(error){
                        next(new ServerError(error));
                    }else{
                        res.cookie("uid",user._id,cookieProperties);
                        res.json(user);   
                    }
                });
            }
        });
    }
});

//Fectch current user data
router.get('/user',function(req,res,next){
    db.getUser(req.uid,SimpleMongoDbCallback(res,next));
});
//Fectch user data for given id
router.get('/user/:id',function(req,res,next){
    db.getUser(req.params.id,SimpleMongoDbCallback(res,next)); 
});
//Update lastUpdate field for given chat room
router.post('/user/room/:rid/lastupdate',function(req,res,next){
    var timestamp = req.body.timestamp;
    var rid=req.params.rid;
    var uid=req.uid;
    db.updateLastUpdate(uid,rid,new Date(timestamp),SimpleMongoDbCallback(res,next)); 
});
//////////////////////////////////////////////////////////////////////////////////////
//Chat Room API
//////////////////////////////////////////////////////////////////////////////////////
router.get('/room/:id',function(req,res,next){
    db.getChatRoom(req.params.id,SimpleMongoDbCallback(res,next));  
});
router.get('/rooms',function(req,res,next){
    db.getChatRooms(SimpleMongoDbCallback(res,next)); 
});

router.post('/room/create',function(req,res,next){
    var room = req.body;
    var uid= req.uid;
    if(!room.name || room.name.length==0){
        next(new BadRequest("Bad Request: chat room must have a name."));
    }else{
        chainedFunctionsCall(
            function(proxyFunction){
                db.createChatRoom(new entities.ChatRoom(room.name,uid),proxyFunction);
            },function(proxyFunction, newlyCreatedRoom){
                proxyFunction.newlyCreatedRoom = newlyCreatedRoom;
                proxyFunction.rid=newlyCreatedRoom._id.toString();
                db.joinChatRoom(proxyFunction.rid,uid,proxyFunction);
            },function(proxyFunction){
                db.addChatRoom(uid,proxyFunction.rid,proxyFunction);
            },function(proxyFunction,isError,errors,results){
                if(isError){
                    console.log("Failed to create new chat room "+errors);
                    next(new ServerError("failed to create chat room"));
                }else{
                    res.json(proxyFunction.newlyCreatedRoom);
                }
            });
    }
});

router.post('/room/join',function(req,res,next){
    var rid= req.body.room ;
    var uid = req.uid;

    if(!rid|| rid.length===0){
        next(new BadRequest("Bad Request: must contains a room id"));
    }else{
        chainedFunctionsCall(
            function(proxyFunction){
                db.joinChatRoom(rid,uid,proxyFunction);
            },function(proxyFunction){
                db.addChatRoom(uid,rid,proxyFunction);
            },function(proxyFunction){
                db.getChatRoom(req.params.id,proxyFunction); 
            },function(proxyFunction,isError,errors,results){
                if(isError){
                    console.log("Failed to create new chat room "+errors);
                    next(new ServerError("failed to create chat room"));
                }else{
                    //return last element in results, it contains the updated room
                    res.json(results[results.length-1]);
                }
            });
    }
  
});
router.post('/room/leave',function(req,res,next){
    var rid= req.body.room ;
    var uid = req.uid;

    if(!rid|| rid.length===0){
        next(new BadRequest("Bad Request: must contains a room id"));
    }else{
        chainedFunctionsCall(
            function(proxyFunction){
                db.leaveChatRoom(rid,uid,proxyFunction);
            },function(proxyFunction){
                db.deleteChatRoom(uid,rid,proxyFunction);
            },function(proxyFunction){
                db.getChatRoom(req.params.id,proxyFunction); 
            },function(proxyFunction,isError,errors,results){
                if(isError){
                    console.log("failed to leave chat room "+errors);
                    next(new ServerError("failed to leave chat room "));
                }else{
                    //return last element in results, it contains the updated room
                    res.json(results[results.length-1]);
                }
            });
    }
  
});

//////////////////////////////////////////////////////////////////////////////////////
//Messages APi
//////////////////////////////////////////////////////////////////////////////////////

router.post('/room/:id/newmessage',function(req,res,next){
    var messageRequest = req.body;
    if(!messageRequest.message){
        next(new BadRequest("Bad Request: must contains a message"));
    }else{
        db.message.insert(new entities.Message(req.uid,req.params.id,messageRequest.message),SimpleMongoDbCallback(res));
    }
});

router.get('/room/:id/messages',function(req,res,next){
    var rid=req.params.id;
    var uid = req.uid;
    chainedFunctionsCall(
        function(proxyFunction){
            db.getUser(uid,proxyFunction);
        },function(proxyFunction,currentUser){
            var isCurrentUserInTheChatRoom = false;
            var timestamp;
            currentUser.chatRoomStatus.forEach(function(chatRoomStatus){
                if(chatRoomStatus.rid === rid){
                    isCurrentUserInTheChatRoom = true;
                    timestamp=chatRoomStatus.lastUpdate;
                }
            });
            if(!isCurrentUserInTheChatRoom)
                proxyFunction.error = new BadRequest("Bad Request: user must join the chat room first");
            db.retrieveMessages(rid,uid,timestamp,proxyFunction);
        },function(proxyFunction,error,errorsFromFunctionCall,resultsFromFunctionCall){
            if(error){
                console.log("failed to retrieve messages "+error);
                next(new ServerError("failed to retrieve messages "));
            }else{
                //return last element in results, it contains the messages
                res.json(resultsFromFunctionCall[resultsFromFunctionCall.length-1]);
            }
        });
});

router.get('/room/:id/messagesSinceLastupdate',function(req,res,next){
    var roomID=req.params.id;
    console.log(roomID);  
    db.user.find({
        _id:mongojs.ObjectId(req.uid)
    },{"chatRoomStatus":{$elemMatch: {rid:roomID}}},function(error,userData){
        console.log(userData);  
        if(error){
            next( new ServerError(error));
        }if(!userData[0]){
            next( new ServerError(""));
        }else{ 
            retrieveMessages(res,next,req.uid,roomID,userData[0].chatRoomStatus[0].lastUpdate);
        }
    });
});

module.exports = router;

