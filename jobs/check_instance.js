'use strict';

const util = require('util');
const dns = require('dns');
const resolve6 = util.promisify(dns.resolve6);
const request = require('../helpers/request');
const Instance = require('../models/instance');

async function checkInstance(options) {
    const instance = await Instance.findByPk(options.instance);

    if(!instance)
        throw new Error(`No instance has ID ${options.instance}.`);

    if(instance.latest_check && instance.latest_check.getTime() > new Date().getTime() - 5 * 60 * 1000)
        return;

    instance.latest_check = new Date();

    if(!instance.software) {
        let software = await instance.guessSoftware();

        if(!software) {
            instance.logError(`Could not guess instance software.`);
            instance.up = false;
            await instance.save();

            return;
        }

        instance.software = software.id;
    }

    // Now that we know instance is Mastodon or Pleroma (or looks like), we can check if it is up and gather some stats.
    let instanceInfo;
    try {
        instanceInfo = await instance.getMastodonInstanceInfo();

        if(!instanceInfo) {
            throw new Error('Empty info object');
        }
    } catch(e) {
        instance.logError(`Could not get instance info: "${e.message}".`);
        instance.up = false;
        await instance.save();

        return;
    }

    instance.up = true;

    if(instanceInfo.stats) {
        instance.users = instanceInfo.stats.user_count || 0;
        instance.statuses = (instanceInfo.stats.status_count || 0) + ''; // Converted to string because pg stores it as bigint
        instance.connections = instanceInfo.stats.domain_count || 0;
    }

    instance.email = instanceInfo.email || null;
    if(instanceInfo.contact_account) {
        instance.admin = instanceInfo.contact_account.username;
    } else {
        instance.admin = null;
    }

    instance.thumbnail = instanceInfo.thumbnail;
    instance.raw_version = instanceInfo.version;
    instance.version = (instanceInfo.version || '').substr(0, 7);

    try {
        let addresses = await resolve6(instance.name);

        instance.ipv6 = addresses.length > 0;
    } catch(e) {
        instance.ipv6 = false;
    }

    instance.open_registrations = !!instanceInfo.registrations;

    instance.title = instanceInfo.title;
    instance.description = instanceInfo.description;
    instance.short_description = instanceInfo.short_description;

    await instance.save();

    if(!instance.latest_https_check || instance.latest_https_check.getTime() < new Date().getTime() - 24*60*60*1000) {
        await instance.queueHttpsCheck();
    }

    if(!instance.latest_obs_check || instance.latest_obs_check.getTime() < new Date().getTime() - 24*60*60*1000) {
        await instance.queueObsCheck();
    }

    if(!instance.latest_history_save || instance.latest_history_save.getTime() < new Date().getTime() - 60*60*1000)
        await instance.queueHistorySaving();

    if(instance.software === 1 && (!instance.latest_ap_check || instance.latest_ap_check.getTime() < new Date().getTime() - 24*60*60*1000))
        await instance.queueAPFetch();
}

module.exports = checkInstance;
