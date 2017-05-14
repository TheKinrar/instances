const router = require('express').Router();
const APIUtils = require('../../../../helpers/APIUtils');

router.get('/list', (req, res) => {

    DB.get('instances').distinct('infos.theme').then(themes => {

        let jsons = [];
        if(themes.length > 0) {
            themes.forEach((theme) => {
                if(theme != null)
                    jsons.push(theme);
            });
        }

        res.json({
            themes: jsons
        });
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

module.exports = router;