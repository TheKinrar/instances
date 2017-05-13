module.exports = () => {
    const db_instances = DB.get('instances');
    const db_versions = DB.get('versions');

    Request.get('https://api.github.com/repos/tootsuite/mastodon/releases', (err, res) => {
        if(err) return console.error(err);

        db_instances.count({up:true}).then((total) => {
            let version_names = [];

            let versions = JSON.parse(res.body);
            versions.push({
                id: 0,
                name: '<1.3'
            });

            versions.forEach((version) => {
                if(version.name.startsWith('v'))
                    version.name = version.name.substring(1);

                version_names.push(version.name);

                db_versions.findOne({
                    _id: version.id
                }).then((_version) => {
                    if (!_version) {
                        db_versions.insert({
                            _id: version.id,
                            name: version.name,
                            publishedAt: version.published_at
                        });
                    }

                    db_instances.count({
                        version: version.name,
                        up: true
                    }).then((count) => {
                        db_versions.update({
                            _id: version.id
                        }, {
                            $set: {
                                instances: count,
                                instances_ratio: count / total
                            }
                        });
                    }).catch(console.error);
                }).catch(console.error);
            });

            db_versions.findOne({
                _id: -1
            }).then((_version) => {
                if (!_version) {
                    db_versions.insert({
                        _id: -1,
                        name: 'Unknown'
                    });
                }

                db_instances.count({
                    version: {
                        $nin: version_names
                    },
                    up: true
                }).then((count) => {
                    db_versions.update({
                        _id: -1
                    }, {
                        $set: {
                            instances: count,
                            instances_ratio: count / total
                        }
                    });
                }).catch(console.error);
            }).catch(console.error);
        }).catch(console.error);
    });
};