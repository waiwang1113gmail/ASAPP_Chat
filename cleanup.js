//delete database
var config = require('./configs/config');
var mongojs = require('mongojs');
var db = mongojs(config.db
            ,['message','chat_room','user']);

db.message.remove();
db.chat_room.remove();
db.user.remove();