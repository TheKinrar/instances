const https = require('https');
const dns = require('dns');

module.exports = () => {
	const db_instances = DB.get('instances');

	db_instances.find().then((instances) => {
		instances.forEach((instance) => {
			let url = 'https://' + instance.name;

			getHttpsRank(instance.name, (err, rank) => {
				if(err) return;

				checkIpv6(instance.name, (is_ipv6) => {
					getStats(url, (err, stats) => {
						if(err) {
							db_instances.update({
								_id: instance._id
							}, {
								$set: {
									https_rank: rank.rank,
									https_score: rank.score,
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
										ipv6: is_ipv6,
										up: true,
										users: stats.users,
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
	  				score += host.grade.details.score;

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
		    let regex_users = /<strong>([0-9,]+)<\/strong>\n<span>users<\/span>/;
		    let res_users = regex_users.exec(rawData);

		    if(res_users && res_users[1]) {
		    	try {
		    		let users = parseInt(res_users[1].replace(',', ''));

				    cb(null, {
				    	users
				    });
		    	} catch(e) {
		    		return cb(e);
		    	}
		    }
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
		});
	} catch(e) {
		ch(false);
	}
}