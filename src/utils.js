const fs = require("fs");

function readJson(filename){
    try{
        const data = fs.readFileSync("init/"+filename+".json");
        return JSON.parse(data);
    } catch(err){
        console.error(err);
    }
}

function isEmail(email){
    const emailRegex = new RegExp(/^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/, "gm");
    return emailRegex.test(email);
}

function keepFields(obj, ...props){
    return props.reduce((res, prop) => {
        res[prop] = obj[prop];
        return res;
    }, {});
}   

function remFields(obj, ...props){
    const res = {...obj};

    props.forEach((prop) => {
        delete res[prop];
    });
    return res;
}   

module.exports = { readJson, isEmail, keepFields, remFields };