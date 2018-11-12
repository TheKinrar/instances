const router = require('express-promise-router')();
const randomstring = require('randomstring');
const passwordHash = require('password-hash');
const Languages = require('languages');
const pg = require('../../pg');
const Instance = require('../../models/instance');
const parseDomain = require('parse-domain');
const config = require('../../config');
const Mailgun = require('mailgun-js')({
    apiKey: config.mailgun.key,
    domain: config.mailgun.domain
});
const Mastodon = new require('mastodon')({
    access_token: config.bot_access_token,
    api_url: 'https://mastodon.xyz/api/v1/'
});

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
});

router.get('/', (req, res) => {
    if(!req.user) {
        return res.render('admin/index');
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
            otherProhibitedContent: instance.infos.otherProhibitedContent.join(', ')
        });
    }).catch((e) => {
        console.error(e);
        res.sendStatus(500);
    });
});

router.get('/logout', async (req, res) => {
    req.session.destroy();

    res.redirect('/admin');
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
        res.flash('error', {
            header: 'Validation failed.',
            body: msg
        });

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

    if(categories.length > 2)
        return error('You cannot select more than two categories. Select none if your instance is generalist.');

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

router.post('/sign_up', async (req, res) => {
    let domain = parseDomain(req.body.instance);
    if(domain === null) {
        res.flash('error', {
            header: 'Sign up failed.',
            body: 'Invalid instance name.'
        });

        return res.redirect('/admin');
    }
    let domain_str = `${domain.subdomain ? domain.subdomain + '.' : ''}${domain.domain}.${domain.tld}`;

    let admin = await DB.get('admins').findOne({
        instance: domain_str
    });

    let activation_token;
    if(admin) {
        if(admin.activated) {
            res.flash('error', {
                header: 'Sign up failed.',
                body: 'Already registered. Use the login form on the right.'
            });

            return res.redirect('/admin');
        }

        activation_token = admin.activation_token;
    } else {
        activation_token = randomstring.generate(64);

        try {
            await DB.get('admins').insert({
                createdAt: new Date(),
                instance: domain_str,
                activation_token
            });
        } catch(e) {
            return res.sendStatus(500);
        }

        try {
            await DB.get('instances').insert({
                addedAt: new Date(),
                name: domain_str,
                downchecks: 0,
                upchecks: 0
            });
        } catch (e) {}

        try {
            await Instance.create({
                name: domain_str
            });
        } catch(e) {}
    }

    let instance = await Instance.findOne({
        where: {
            name: domain_str
        }
    });

    if(!instance)
        return res.sendStatus(500);

    let software = await instance.guessSoftware();

    if(!software || software.id !== 1) {
        res.flash('error', {
            header: 'Sign up failed.',
            body: 'It looks like this instance is not a Mastodon instance. ' +
                'Other fediverse instances can show up on instances.social ' +
                'but are not (yet) compatible with this admin space.'
        });

        return res.redirect('/admin');
    }

    let instanceInfo;
    try {
        instanceInfo = await instance.getMastodonInstanceInfo();
    } catch (e) {
        res.flash('error', {
            header: 'Sign up failed.',
            body: `Could not get instance info: "${e.message}".`
        });

        return res.redirect('/admin');
    }

    req.session.unactivated_user = instance.name;
    req.session.instanceInfo = instanceInfo;
    res.redirect('/admin/activate');
});

router.get('/activate', async (req, res) => {
    if(typeof req.query.token === 'string' && req.query.token) {
        let admin = await DB.get('admins').findOne({
            activation_token: req.query.token,
            activated: {
                $ne: true
            }
        });

        if(!admin)
            return res.sendStatus(404);

        return res.render('admin/activate/token', {
            token: admin.activation_token
        });
    }

    if(!req.session.unactivated_user || !req.session.instanceInfo)
        return res.sendStatus(403);

    res.render('admin/activate/index', {
        instanceInfo: req.session.instanceInfo
    });
});

router.post('/activate/dm', async (req, res) => {
    if(!req.session.unactivated_user || !req.session.instanceInfo)
        return res.sendStatus(403);

    try {
        let admin = await DB.get('admins').findOne({
            instance: req.session.unactivated_user
        });

        if(admin) {
            await Mastodon.post('statuses', {
                status: `@${req.session.instanceInfo.contact_account.username}@${req.session.instanceInfo.uri} You or someone else tried to sign up on instances.social.

Confirm your registration here: https://instances.social/admin/activate?token=${admin.activation_token}`,
                visibility: 'direct',
                language: 'eng'
            });

            res.flash('success', {
                header: 'Verification DM sent.',
                body: `Please click the link in the DM. If you don't receive it, you can ask for a new DM (or an email) by going through the sign up process below again.`
            });
        } else {
            res.flash('error', {
                header: 'Sign up failed.',
                body: `Server error.`
            });
        }
    } catch(e) {
        res.flash('error', {
            header: 'Sign up failed.',
            body: `Could not send DM.`
        });
    }

    res.redirect('/admin');
});

router.post('/activate/email', async (req, res) => {
    if(!req.session.unactivated_user || !req.session.instanceInfo)
        return res.sendStatus(403);

    try {
        let admin = await DB.get('admins').findOne({
            instance: req.session.unactivated_user
        });

        if(admin) {
            await Mailgun.messages().send({
                from: 'instances.social <no-reply@mastodon.xyz>',
                to: req.session.instanceInfo.email,
                subject: 'instances.social sign up',
                text: `You or someone else tried to sign up on https://instances.social as admin of the instance ${req.session.unactivated_user}.

Confirm your registration here: https://instances.social/admin/activate?token=${admin.activation_token}

If you did not request this e-mail, you may just ignore it, or confirm registration anyway if you want to customize your instance listing (and make it appear on joinmastodon.org).`
            });

            res.flash('success', {
                header: 'Verification email sent.',
                body: `Please click the link in the email. Check your spams. If you don't receive it, you can ask for a new email (or a DM) by going through the sign up process below again.`
            });
        } else {
            res.flash('error', {
                header: 'Sign up failed.',
                body: `Server error.`
            });
        }
    } catch(e) {
        res.flash('error', {
            header: 'Sign up failed.',
            body: `Could not send email.`
        });
    }

    res.redirect('/admin');
});

router.post('/activate', (req, res) => {
    if(typeof req.body.token !== 'string' || !req.body.token ||
        typeof req.body.password1 !== 'string' || !req.body.password1 ||
        typeof req.body.password2 !== 'string' || !req.body.password2) {
        res.flash('error', {
            header: 'Activation failed.',
            body: `Invalid form data.`
        });

        return res.redirect('/admin/activate?token=' + req.body.token);
    }

    if(req.body.password1 !== req.body.password2) {
        res.flash('error', {
            header: 'Activation failed.',
            body: `Passwords do not match.`
        });

        return res.redirect('/admin/activate?token=' + req.body.token);
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
                    }),
                    emailConsent: req.body.emailConsent
                }
            }).then(() => {
                res.flash('success', {
                    header: 'Activation succeeded.',
                    body: `You may now login using the form on the right.`
                });

                return res.redirect('/admin');
            }).catch((e) => {
                console.error(e);
                res.sendStatus(500);
            });
        }).catch((e) => {
            console.error(e);
            res.sendStatus(500);
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
            res.flash('error', {
                header: 'Login failed.',
                body: `Invalid instance.`
            });

            return res.redirect('/admin');
        }

        if(!passwordHash.verify(req.body.password, admin.password)) {
            res.flash('error', {
                header: 'Login failed.',
                body: `Invalid password.`
            });

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