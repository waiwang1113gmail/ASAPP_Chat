process.env.NODE_ENV ="DEVELOPMENT";

var config = require('./configs/config');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var api = require('./routes/api');
var UnauthenticatedError = require('./modules/response').UnauthenticatedError;


//Configuration 
const LOGIN_PATH='/api/login';

var app = express();

//All static contents are not protected
app.use(express.static(path.join(__dirname,'client')));

//To use bodydoy parser to paser json format data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(cookieParser());

//logoff 
app.get("/logoff",function(req,res,next){
    res.cookie("uid","",{expires: new Date(0)});
    res.json({});
});
//Simple authentication middleware
app.use(function(req,res,next){ 
    //If the request does not contains session cookie, or it is not
    //a login request, send error response
    //otherwise, add uid to request object  
    if(!req.cookies.uid && !(req.path===LOGIN_PATH)){
        next(new UnauthenticatedError());
    } 
    req.uid=req.cookies.uid;
    next();
})

app.use('/api',api);

//Error handling middleware 
app.use(function(error,req,res,next){  
    res.status(error.code);
    res.json(error);
});
var server = app.listen(config.port,function(){
    console.log('Server started on port: '+ config.port);
});

module.exports = server;