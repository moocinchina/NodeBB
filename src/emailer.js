"use strict";

var	fs = require('fs'),
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	templates = require('templates.js'),

	User = require('./user'),
	Plugins = require('./plugins'),
	meta = require('./meta'),
	translator = require('../public/src/modules/translator'),

	app;

(function(Emailer) {
	Emailer.registerApp = function(expressApp) {
		app = expressApp;
		return Emailer;
	};

	Emailer.send = function(template, uid, params, callback) {
		if (!callback) { callback = function() {}; }
		if (!app) {
			winston.warn('[emailer] App not ready!');
			return callback();
		}

		async.parallel({
			html: function(next) {
				app.render('emails/' + template, params, next);
			},
			plaintext: function(next) {
				app.render('emails/' + template + '_plaintext', params, next);
			},
			email: async.apply(User.getUserField, uid, 'email'),
			settings: async.apply(User.getSettings, uid)
		}, function(err, results) {
			if (err) {
				winston.error('[emailer] Error sending digest : ' + err.stack);
				return callback(err);
			}
			async.map([results.html, results.plaintext, params.subject], function(raw, next) {
				translator.translate(raw, results.settings.userLang || meta.config.defaultLang || 'en_GB', function(translated) {
					next(undefined, translated);
				});
			}, function(err, translated) {
				if (err) {
					winston.error(err.message);
					return callback(err);
				} else if (!results.email) {
					winston.warn('uid : ' + uid + ' has no email, not sending.');
					return callback();
				}

				if (Plugins.hasListeners('action:email.send')) {
					Plugins.fireHook('action:email.send', {
						to: results.email,
						from: meta.config['email:from'] || 'no-reply@localhost.lan',
						subject: translated[2],
						html: translated[0],
						plaintext: translated[1],
						template: template,
						uid: uid,
						pid: params.pid,
						fromUid: params.fromUid
					});
					callback();
				} else {
					winston.warn('[emailer] No active email plugin found!');
					callback();
				}
			});
		});
	};

	Emailer.sendPlus = function(params, callback) {
		if (!callback) { callback = function() {}; }
		if (!app) {
			winston.warn('[emailer] App not ready!');
			return callback();
		}

		async.parallel({
			fromname: function(next) {
				templates.parse(meta.config['email:' + params.template + ':fromname'], params, function (data) {
					next(null, data);
				});
			},
			html: function(next) {
				templates.parse(meta.config['email:' + params.template + ':html'], params, function (data) {
					next(null, data);
				});
			},
			subject: function(next) {
				templates.parse(meta.config['email:' + params.template + ':subject'], params, function (data) {
					next(null, data);
				});
			},
			email: async.apply(User.getUserField, params.uid, 'email')
		}, function(err, results) {
			if (err) {
				winston.error('[emailer] Error sending digest : ' + err.stack);
				return callback(err);
			}

			if (Plugins.hasListeners('action:email.send')) {
				var email = {
					to: params.email || results.email,
					from: meta.config['email:from'] || 'no-reply@localhost.lan',
					subject: results.subject,
					html: results.html,
					uid: params.uid,
					template: params.template,
					fromUid: params.uid,
					fromname: results.fromname
				};
				if (params.trackId) {
					email.trackId = params.trackId;
				}
				Plugins.fireHook('action:email.send', email);
				callback();
			} else {
				winston.warn('[emailer] No active email plugin found!');
				callback();
			}
		});
	};
}(module.exports));

