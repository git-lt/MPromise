var File = require("./fs-promise-chain");

var inputFilePath = "input.txt",
    outputFilePath = "output.txt";

File.read(inputFilePath)
    .transform(function (content) {
        return ">>" + content;
    })
    .write(outputFilePath)
    .catch(function(err){
    	console.log(err)
    })