const router = require('express-promise-router')();
const randomstring = require('randomstring');
const passwordHash = require('password-hash');
const Languages = require('languages');
const pg = require('../../pg');

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
});

router.use('/admin', require('./admin'));

router.get('/', (req, res) => {
    if(!req.user) {
        return res.render('admin/index', {
            messages: {
                info: req.flash('info'),
                error: req.flash('error')
            }
        });
    }

    DB.get('instances').findOne({
        name: req.user.instance
    }).then((instance) => {
        if(!instance.infos) {
            instance.infos = {
              shortDescription: '',
              fullDescription: '',
              theme: '',
              categories: [],
              languages: [],
              noOtherLanguages: false,
              prohibitedContent:
               [],
              otherProhibitedContent: [],
              federation: 'all',
              bots: 'yes',
              brands: 'yes',
              optOut: false
            };
        }

        res.render('admin/dashboard', {
            instance,
            langs: Languages.getAllLanguageCode().map(function(e) {
                var info = Languages.getLanguageInfo(e);
                info.code = e;
                return info;
            }).sort(function(a, b) {
                return a.name.localeCompare(b.name);
            }),
            otherProhibitedContent: instance.infos.otherProhibitedContent.join(', '),
            messages: {
                validationError: req.flash('validationError')
            }
        });
    }).catch((e) => {
        console.error(e);
        res.sendStatus(500);
    });
});

router.get('/statistics', async (req, res) => {
    if(!req.user) {
        return res.render('admin/index');
    }

    let pgc = await pg.connect();

    let token = await pgc.query('SELECT stats_token FROM instances WHERE name=$1', [
        req.user.instance
    ]);

    if(!token.rows[0].stats_token) {
        token = await pgc.query('UPDATE instances SET stats_token=$1 WHERE name=$2 RETURNING stats_token', [
            randomstring.generate(64),
            req.user.instance
        ]);
    }

    res.render('admin/dashboard/statistics', {
        token: token.rows[0].stats_token
    });

    await pgc.release();
});

router.post('/', (req, res) => {
    if(!req.user)
        return res.redirect('/admin');

    const error = (msg) => {
        req.flash('validationError', msg);
        res.redirect('/admin');
    };

    let optOut = req.body.optOut === 'on';

    if(!isNonEmptyString(req.body.shortDescription))
        return error('Missing short description.');

    if(!isNonEmptyString(req.body.fullDescription))
        return error('Missing full description.');

    let theme = req.body.theme;
    if(!isNonEmptyString(theme))
        theme = null;

    let categories = stringOrArrayToArray(req.body.categories);
    if(!categories)
        categories = [];

    let languages = stringOrArrayToArray(req.body.languages);
    if(!languages)
        languages = [];

    for(let language of languages)
        if(!Languages.isValid(language))
            return error('Invalid language: ' + language);

    let noOtherLanguages = req.body.noOtherLanguages === 'on';

    let prohibitedContent = stringOrArrayToArray(req.body.prohibitedContent);
    if(!prohibitedContent)
        prohibitedContent = [];

    let otherProhibitedContent = commaListToArray(req.body.otherProhibitedContent);
    if(!otherProhibitedContent)
        otherProhibitedContent = [];

    /*let federation = req.body.federation;
    if(!isNonEmptyString(federation) || !['all', 'some'].includes(federation))
        return error('Missing federation policy.');*/

    let infos = {
        optOut,
        shortDescription: req.body.shortDescription,
        fullDescription: req.body.fullDescription,
        theme,
        categories,
        languages,
        noOtherLanguages,
        prohibitedContent,
        otherProhibitedContent,
        //federation
    };

    console.log(req.body);
    console.log(infos);

    DB.get('instances').update({
        name: req.user.instance
    }, {
        $set: {
            infos
        }
    });

    res.redirect('/admin');
});

router.post('/sign_up', (req, res) => {
    if(typeof req.body.instance !== 'string' || !req.body.instance)
        return res.sendStatus(400);

    Request.get('https://' + req.body.instance + '/api/v1/instance', (err, resp, body) => {
        if(err) {
            return res.sendStatus(400);
        }

        req.body.instance = req.body.instance.toLowerCase();

        let instanceJson = JSON.parse(body);

        DB.get('admins').findOne({
            instance: req.body.instance
        }).then((admin) => {
            if(admin)
                return res.sendStatus(400);

            const activation_token = randomstring.generate(64);

            DB.get('instances').insert({
                addedAt: new Date(),
                name: req.body.instance,
                downchecks: 0,
                upchecks: 0
            }).catch((e) => {});

            DB.get('admins').insert({
                createdAt: new Date(),
                instance: req.body.instance,
                activation_token
            }).then(() => {
                Mailgun.messages().send({
                    from: 'Mastodon Instances <no-reply@mastodon.xyz>',
                    to: instanceJson.email,
                    subject: 'Mastodon instances list sign up',
                    text: `You or someone else tried to sign up on https://instances.mastodon.xyz as admin of the instance ${instanceJson.uri}.

Confirm your registration here: https://instances.mastodon.xyz/admin/activate?token=${activation_token}

If you did not request this e-mail, you may just ignore it, or confirm registration anyway if you want your instance to appear in the list.`
                }, () => {
                    res.json({
                        email: instanceJson.email
                    });
                });
            }).catch((err) => {
                return res.sendStatus(500);
            });
        }).catch((err) => {
            return res.sendStatus(500);
        });
    });
});

router.get('/activate', (req, res) => {
    if(typeof req.query.token !== 'string' || !req.query.token)
        return res.sendStatus(400);

    DB.get('admins').findOne({
        activation_token: req.query.token,
        activated: {
            $ne: true
        }
    }).then((admin) => {
        if(!admin)
            return res.sendStatus(404);

        res.render('admin/activate', {
            token: admin.activation_token
        });
    }).catch((e) => {
        res.sendStatus(500);
    });
});

router.post('/activate', (req, res) => {
    if(typeof req.body.token !== 'string' || !req.body.token)
        return res.sendStatus(400);
    if(typeof req.body.password1 !== 'string' || !req.body.password1)
        return res.sendStatus(400);
    if(typeof req.body.password2 !== 'string' || !req.body.password2)
        return res.sendStatus(400);

    if(req.body.password1 !== req.body.password2) {
        res.render('admin/activate', {
            token: req.body.token,
            passwordsDismatch: true
        });
    } else {
        DB.get('admins').findOne({
            activation_token: req.body.token,
            activated: {
                $ne: true
            }
        }).then((admin) => {
            if(!admin)
                return res.sendStatus(404);

            DB.get('admins').update({
                _id: admin._id
            }, {
                $set: {
                    activated: true,
                    password: passwordHash.generate(req.body.password1, {
                        algorithm: 'sha256'
                    })
                }
            }).then(() => {
                req.flash('info', 'adminRegistered');
                res.redirect('/admin');
            }).catch((e) => {
                console.error(e);
                res.sendStatus(500);
console.error(e);
            });
        }).catch((e) => {
            console.error(e);
            res.sendStatus(500);
console.error(e);
        });
    }
});

router.post('/login', (req, res) => {
    if(typeof req.body.instance !== 'string' || !req.body.instance)
        return res.sendStatus(400);
    if(typeof req.body.password !== 'string' || !req.body.password)
        return res.sendStatus(400);

    DB.get('admins').findOne({
        instance: req.body.instance
    }).then((admin) => {
        if(!admin) {
            req.flash('error', 'invalidInstance');
            return res.redirect('/admin');
        }

        if(!passwordHash.verify(req.body.password, admin.password)) {
            req.flash('error', 'invalidPassword');
            return res.redirect('/admin');
        }

        req.session.user = admin._id;
        res.redirect('/admin');
    });
});

module.exports = router;

function stringOrArrayToArray(input) {
    if(typeof input === 'string')
        return [input];

    if(Array.isArray(input))
        return input;

    return null;
}

function commaListToArray(list) {
    if(typeof list !== 'string' || !list)
        return null;

    return list.split(',').map((e) => {
        return e.trim();
    });
}

function isNonEmptyString(input) {
    return typeof input === 'string' && input.length > 0;
}