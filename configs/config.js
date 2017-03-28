var obj={};

switch(process.env.NODE_ENV){
    case 'DEVELOPMENT':
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@ds031278.mlab.com:31278/mychat",
            "sessionLength":10000000

        }
        break;
    case 'TESTING':
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@ds141950.mlab.com:41950/testing",
            "sessionLength":10000000
        }
        break;
    default:
        obj={
            "port" : 9000,
            "db": "mongodb://test:password@ds031278.mlab.com:31278/mychat",
            "sessionLength":10000000
        }
        
} 
module.exports = obj;