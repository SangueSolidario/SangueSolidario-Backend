const fs = require("fs");

function readJson(filename){
    try{
        const data = fs.readFileSync("init/"+filename+".json");
        return JSON.parse(data);
    } catch(err){
        console.error(err);
    }
}

module.exports = { readJson };