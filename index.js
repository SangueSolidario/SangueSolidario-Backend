const express = require("express");
const app = express()
const port = process.env.PORT || 3000;

app.get("/campanha/:id", (req, res) => {

    if(req.params.id == 1){
        return res.status(200).json({
            "ID": "1",
            "Nome": "Campanha 1",
            "DataInicio": "2017-01-01",
            "DataFim": "2017-01-31",
            "Imagem": "Url para Blob Storage",
            "Descricao": "Campanha 1",
            "TiposSanguineoNecessario": ["A+", "B+"],
            "Local": "Local 1",
            "Status": "Ativa"
        });
    }

    return res.status(404).json({"message": "Não existe!"});
});

app.get("/campanhas", (req, res) => {
    try{
        
        return res.status(200).json({
            "ID": "1",
            "Nome": "Campanha 1",
            "DataInicio": "2017-01-01",
            "DataFim": "2017-01-31",
            "Imagem": "Url para Blob Storage",
            "Descricao": "Campanha 1",
            "TiposSanguineoNecessario": ["A+", "B+"],
            "Local": "Local 1",
            "Status": "Ativa"
        });
    } catch(error){
        return res.status(500).json({"message": error});
    }
});

app.listen(port, () => {
    console.log(`App a executar na porta ${port}`);
});