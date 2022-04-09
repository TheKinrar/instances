'use strict';

const request = require('../helpers/request');
const Instance = require('../models/instance');

async function checkInstanceHttps(options) {
    const instance = await Instance.findByPk(options.instance);

    if(!instance)
        throw new Error(`No instance has ID ${options.instance}.`);

    if(instance.latest_https_check && instance.latest_https_check.getTime() > new Date().getTime() - 24 * 60 * 60 * 1000)
        return;

    instance.latest_https_check = new Date();

    let res;
    try {
        res = await request({
            url: `https://cryptcheck.fr/https/${instance.name}.json`,
            json: true
        });
    } catch(e) {
        await instance.save();
        return;
    }

    let grade = null;
    let score = 0;

    let n = 0;
    if(!res.pending && res.result) {
        for (let host of res.result) {
            if (host.grade) {
                n++;

                switch (host.grade) {
                    case 'A+':
                        score += 100;
                        break;
                    case 'A':
                        score += 80;
                        break;
                    case 'B':
                        score += 60;
                        break;
                    case 'C':
                        score += 40;
                        break;
                    case 'D':
                        score += 20;
                        break;
                    case 'E':
                        score += 10;
                        break;
                    case 'F':
                        score += 5;
                        break;
                }

                grade = host.grade;
            }
        }

        score /= n;
    }

    instance.https_score = score || null;
    instance.https_rank = grade || null;

    await instance.save();
}

module.exports = checkInstanceHttps;
