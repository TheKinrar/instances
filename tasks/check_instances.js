const https = require('https');
const dns = require('dns');
const request = require('request');
const querystring = require('querystring');

const regex_infoboard = new RegExp([
	/<div class='information-board'>/,
	/<div class='section'>/,
	/<span>(?:.+)<\/span>/,
	/<strong>([0-9,]+)<\/strong>/,
	/<span>(?:.+)<\/span>/,
	/<\/div>/,
	/<div class='section'>/,
	/<span>(?:.+)<\/span>/,
	/<strong>([0-9,]+)<\/strong>/,
	/<span>(?:.+)<\/span>/,
	/<\/div>/,
	/<div class='section'>/,
	/<span>(?:.+)<\/span>/,
	/<strong>([0-9,]+)<\/strong>/,
	/<span>(?:.+)<\/span>/,
	/<\/div>/,
	/<\/div>/,
	/(?:<div class='panel'>((?:.|\n)*?)<\/div>)?/
].map(r => r.source).join('\\n'));

const instances_seconds = {};

module.exports = () => {
	const db_instances = DB.get('instances');
	const second = new Date().getSeconds();

	db_instances.find().then((instances) => {
		instances.forEach((instance) => {
			let url = 'https://' + instance.name;

			if(instance.blacklisted)
				return;

			if(!instances_seconds[instance._id]) {
				instances_seconds[instance._id] = Math.floor(Math.random() * 60);
			}

			if(instances_seconds[instance._id] != second)
				return;

			console.log(second + ': Processing ' + instance.name);

			getHttpsRank(instance.name, (err, rank) => {
				if(err) {
					console.error(instance.name, 'CryptCheck failed: ' + err.message);

					if(!instance.https_rank) {
						console.error(instance.name, 'Cancelling update.');
						return;
					} else {
						rank = {
							rank: instance.https_rank,
							score: instance.https_score
						}
					}
				}

				getObsRank(instance.name, (err, obs_rank) => {
					if(err) {
						console.error(instance.name, 'Obs failed: ' + err.message);

						if(!instance.obs_rank) {
							console.error(instance.name, 'Cancelling update.');
							return;
						} else {
							obs_rank = {
								rank: instance.obs_rank,
								score: instance.obs_score
							}
						}
					}

					checkIpv6(instance.name, (is_ipv6) => {
						getStats(url, (err, stats) => {
							if(err) {
								console.error(instance.name, err);

								db_instances.update({
									_id: instance._id
								}, {
									$set: {
										https_rank: rank.rank,
										https_score: rank.score,
										obs_rank: obs_rank.rank,
										obs_score: obs_rank.score,
										ipv6: is_ipv6,
										up: false
									}, $inc: {
										downchecks: 1
									}
								});
							} else {
								areRegistrationsOpened(url, (openRegistrations) => {
									db_instances.update({
										_id: instance._id
									}, {
										$set: {
											https_rank: rank.rank,
											https_score: rank.score,
											obs_rank: obs_rank.rank,
											obs_score: obs_rank.score,
											ipv6: is_ipv6,
											up: true,
											users: stats.users,
											statuses: stats.statuses,
											connections: stats.connections,
											info: stats.info,
											openRegistrations
										}, $inc: {
											upchecks: 1
										}
									});
								});
							}
						});
					});
				});
			});
		});
	});
};

function getHttpsRank(name, cb) {
	https.get('https://tls.imirhil.fr/https/' + name + '.json', (res) => {
	  const statusCode = res.statusCode;
	  const contentType = res.headers['content-type'];

	  if (statusCode !== 200) {
	  	res.resume();
	    return cb(new Error(`Status Code: ${statusCode}, expected 200`));
	  }

	  if (!/^application\/json/.test(contentType)) {
	  	res.resume();
	    return cb(new Error(`Content type: ${contentType}, expected application/json`));
	  }

	  res.setEncoding('utf8');
	  let rawData = '';
	  res.on('data', (chunk) => rawData += chunk);
	  res.on('end', () => {
	  	try {
	  		let data = JSON.parse(rawData);
	  		let grade = null;
	  		let score = 0;

	  		let n = 0;
	  		data.hosts.forEach((host) => {
	  			if(host.grade) {
	  				n++;

	  				switch(host.grade.rank) {
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

	  				if(!grade) {
	  					grade = host.grade.rank;
	  				} else if(grade !== host.grade.rank){
	  					grade += ', ' + host.grade.rank;
	  				}
	  			}
	  		});

	  		score /= n;

		    cb(null, {
		    	score,
		    	rank: grade
		    });
	  	} catch(ex) {
	  		cb(ex);
	  	}
	  });

	  res.on('error', (e) => {
  		cb(e);
	  });
	}).on('error', (e) => {
		cb(e);
	});
}

function getObsRank(name, cb) {
	request.post('https://http-observatory.security.mozilla.org/api/v1/analyze?'+ querystring.stringify({
	  	host: name
	}), (err, res, raw) => {
		if(err) return cb(err);

		const statusCode = res.statusCode;
		if (statusCode !== 200) {
			res.resume();
			return cb(new Error(`Status Code: ${statusCode}, expected 200`));
		}

	    const contentType = res.headers['content-type'];
		if (!/^application\/json/.test(contentType)) {
			res.resume();
			return cb(new Error(`Content type: ${contentType}, expected application/json`));
		}

	  	try {
	  		let data = JSON.parse(raw);

	  		if(data.state === 'FINISHED') {
	  			cb(null, {
	  				rank: data.grade,
	  				score: data.score
	  			});
	  		} else {
	  			cb(new Error('Test isn\'t finished'));
	  		}
	  	} catch(ex) {
	  		cb(ex);
	  	}
	});
}

function checkIpv6(name, cb) {
	dns.resolve6(name, (err, addr) => {
	    cb(!err && addr.length > 0);
	});
}

function getStats(base_url, cb) {
	try {
		const url = base_url + '/about/more';

		https.get(url, (res) => {
		  const statusCode = res.statusCode;
		  const contentType = res.headers['content-type'];

		  if (statusCode !== 200) {
		  	res.resume();
		    return cb(new Error(`Status Code: ${statusCode}, expected 200`));
		  }

		  if (!/^text\/html/.test(contentType)) {
		  	res.resume();
		    return cb(new Error(`Content type: ${contentType}, expected text/html`));
		  }

		  res.setEncoding('utf8');
		  let rawData = '';
		  res.on('data', (chunk) => rawData += chunk);
		  res.on('end', () => {
		    let res_infoboard = regex_infoboard.exec(rawData);

		    if(res_infoboard && res_infoboard[1]) {
		    	try {
		    		let users = parseInt(res_infoboard[1].replace(/,/g, ''));
		    		let statuses = parseInt(res_infoboard[2].replace(/,/g, ''));
		    		let connections = parseInt(res_infoboard[3].replace(/,/g, ''));
		    		let info = res_infoboard[4];

		    		if(!info)
		    			info = '';

		    		info = info.replace(/<\/?[a-z]+>/gi, '');

				    cb(null, {
				    	users,
				    	statuses,
				    	connections,
				    	info
				    });
		    	} catch(e) {
		    		return cb(e);
		    	}
		    } else {
		    	return cb(new Error('Could not parse infoboard.'));
		    }
		  });

		  res.on('error', (e) => {
	  		cb(e);
		  });
		}).on('error', (e) => {
			cb(e);
		});
	} catch(e) {
	    cb(e);
	}
}

function areRegistrationsOpened(url, cb) {
	try {
		https.get(url + '/auth/sign_up', (res) => {
			const statusCode = res.statusCode;

			if (statusCode === 200) {
			    cb(true);
			} else {
			    cb(false);
			}

	    	res.resume();

		    res.on('error', (e) => {
	  		  cb(false);
		    });
		}).on('error', (e) => {
	  		cb(false);
		});
	} catch(e) {
		ch(false);
	}
}
