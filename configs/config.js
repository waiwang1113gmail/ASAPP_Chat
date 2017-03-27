var obj={};

switch(process.env.NODE_ENV){
    case 'DEVELOPMENT':
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@localhost:27017/mychat",
            "sessionLength":10000000

        }
        break;
    case 'TESTING':
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@localhost:27017/testing",
            "sessionLength":10000000
        }
        break;
    default:
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@localhost:27017/mychat",
            "sessionLength":10000000
        }
        
} 
module.exports = obj;