"use strict";

var async = require('async'),
	db = require('../../database'),
	groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	invite = require('../../invite'),
	meta = require('../../meta'),
	websockets = require('../index'),
	Update = {
		version: {}
	};

/**
 * user invite:{iid}
 *
 * status 提名贴的状态显示
 */
Update.version.V11 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			invite.getInviteIds('invite:posts:iid', false, 0, -1, next);
		},
		function (iids, next) {
			invite.getInvitesData(iids, next);
		},
		function (data, next) {
			async.map(data, function (item, next) {
				var iid = item.iid;

				if (parseInt(item.joined, 10) === 1) {
					// 已进社区
					return invite.setInviteField(iid, 'status', 'joined', next);
				} else if (parseInt(item.expired, 10) === 1) {
					// 邀请失败
					return invite.setInviteField(iid, 'status', 'failed', next);
				} else if (parseInt(item.joined, 10) === 0 && parseInt(item.invited, 10) === 1 && parseInt(item.expired, 10) === 0) {
					// 已发邀请
					return invite.setInviteField(iid, 'status', 'invited', next);
				} else if (parseInt(item.invited, 10) === 0) {
					// 正在投票
					return invite.setInviteField(iid, 'status', 'voting', next);
				}
				next();
			}, next);
		}
	], callback);
};

/**
 * user user:{uid}
 *
 * invitedBy rename to invitedByUid
 * invitedByUid 提名该用户的用户ID
 */
Update.version.V12 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:joindate', 0, -1, next);
		},
		function (uids, next) {
			user.getMultipleUserFields(uids, ['uid', 'invitedBy'], next);
		},
		function (userData, next) {
			async.map(userData, function (item, next) {
				async.waterfall([
					function (next) {
						user.setUserField(item.uid, 'invitedByUid', item.invitedBy, next)
					},
					function (next) {
						db.deleteObjectField('user:' + item.uid, 'invitedBy', next);
					}
				], next);
			}, next)
		}
	], callback);
};

/**
 * invite invite:{iid}
 *
 * invitedByUsername 提名人的用户名
 */

Update.version.V13 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			invite.getInviteIds('invite:posts:iid', false, 0, -1, next);
		},
		function (iids, next) {
			var keys = iids.map(function (iid) {
				return 'invite:' + iid;
			});
			next(null, keys);
		},
		function (keys, next) {
			async.each(keys, function (key, next) {
				async.waterfall([
					function (next) {
						db.getObjectField(key, 'uid', next)
					},
					function (uid, next) {
						db.getObjectField('user:' + uid, 'username', next);
					},
					function (username, next) {
						db.setObjectField(key, 'invitedByUsername', username, next);
					}
				], next)

			}, next);
		}
	], callback);
};

/**
 * invite invite:{iid}
 *
 * realUsername 被提名后，注册进入社区的用户名
 */

Update.version.V14 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:joindate', 0, -1, next);
		},
		function (uids, next) {
			user.getMultipleUserFields(uids, ['iid', 'username'], next);
		},
		function (userData, next) {
			async.map(userData, function (item, next) {
				invite.setInviteField(item.iid, 'realUsername', item.username, next);
			}, next);
		}
	], callback);
};

/**
 * user user:{uid}
 *
 * invitedByUsername 提名该用户的用户名
 */

Update.version.V15 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:joindate', 0, -1, next);
		},
		function (uids, next) {
			user.getMultipleUserFields(uids, ['uid', 'invitedByUid'], next);
		},
		function (userData, next) {
			async.map(userData, function (item, next) {
				if (parseInt(item.invitedByUid, 10) === 0) {
					return next();
				}
				async.waterfall([
					function (next) {
						user.getUserField(item.invitedByUid, 'username', next);
					},
					function (username, next) {
						user.setUserField(item.uid, 'invitedByUsername', username, next);
					}
				], next);
			}, next)
		}
	], callback);
};

/**
 * user user:{uid}
 *
 * invitedUsername 该用户对应的提名贴子中的用户名
 */

Update.version.V16 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:joindate', 0, -1, next);
		},
		function (uids, next) {
			user.getMultipleUserFields(uids, ['uid', 'iid'], next);
		},
		function (userData, next) {
			async.map(userData, function (item, next) {
				async.waterfall([
					function (next) {
						invite.getInviteField(item.iid, 'username', next);
					},
					function (username, next) {
						user.setUserField(item.uid, 'invitedUsername', username, next)
					}
				], next)

			}, next);
		}
	], callback);
};

Update.version.V17 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:joindate', 0, -1, next);
		},
		function (uids, next) {
			async.each(uids, function (uid, callback) {
				async.waterfall([
					function (next) {
						db.setObject('user:' + uid + ':settings', {
							dailyDigestFreq: 'day',
							sendChatNotifications: 1,
							sendPostNotifications: 1
						}, next);
					},
					function (next) {
						user.updateDigestSetting(uid, 'day', next);
					}
				], callback);
			}, function(err) {
				if (err) {
					return next(err);
				}
				next();
			});
		}
	], callback);
};

module.exports = Update;
