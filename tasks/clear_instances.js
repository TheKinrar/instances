module.exports = () => {
	const db_instances = DB.get('instances');

	db_instances.remove({
	    upchecks: 0,
	    downchecks: {
	        $gt: 0
	    }
	});
};