const express = require("express");
const app = express()
const port = process.env.PORT || 3000;

app.get("/hello", (req, res) => {
    res.json({"ola": "frontend"});
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});