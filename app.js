'use strict';

let Parser = require('rss-parser');
const Homey = require('homey');
const path = require('path');
const fs = require('fs');
const https = require('https');

const latestLinkToken = new Homey.FlowToken('LatestLink', {
	type: 'string',
	title: 'Latest link'
});

const actionGetNewsLink = new Homey.FlowCardAction("get_News");
const actionPlayLatestTrafficAnnouncement = new Homey.FlowCardAction("PlayLatestTrafficAnnouncement");

class MyApp extends Homey.App {
	onInit() {
		this.log('se.faboul.SwedishTrafficNews is running...');
		this.log('Updating tag with latest information...');

		latestLinkToken.register()
			.then(() => {
				return this.updateToken();
			})
			.catch(err => {
				this.error(err);
			});

		actionGetNewsLink
			.register()
			.registerRunListener((args, state) => {
				this.log('Card trigger');
				return this.updateToken();
			});

		actionPlayLatestTrafficAnnouncement
			.register()
			.registerRunListener(async () => {
				this.log('Homey is playing the news');
				const url = await this.getTrafficAnnouncementUrl();
				await this.playSound(url);
			});
	}

	async updateToken() {
		const url = await this.getTrafficAnnouncementUrl();
		await latestLinkToken.setValue(url);
	}

	async getTrafficAnnouncementUrl() {
		let parser = new Parser({
			customFields: {
				feed: ['description'],
				item: [['enclosure:url'], { keepArray: true }],
			}
		});

		const feed = await parser.parseURL(this.getRssFeedUrl())

		if (feed.items.length > 0) {
			return feed.items[0].enclosure.url;
		} else {
			throw Error('No items found');
		}
	}

	getRssFeedUrl() {
		// Gets the adress for the RSS flow
		return 'https://api.sr.se/api/rss/pod/19126';
	};

	async playSound(url) {
		this.log(`Playing announcement: ${url}`);
		const urlParts = url.split('/');
		const filename = urlParts[urlParts.length - 1];
		const filepath = path.join('./userdata', filename);

		this.log('Downloading annoucement file - start');
		const downloadPromise = new Promise((resolve) => {
			const fileStream = fs.createWriteStream(filepath);

			fileStream.on('finish', () => {
				this.log('Downloading annoucement file - finished');
				resolve();
			});

			https.get(url, (response) => {
				this.log('Downloading annoucement file - downloading');
				response.pipe(fileStream);
			});
		});

		await downloadPromise;

		this.log('Playing annoucement file - start');

		await Homey.ManagerAudio.playMp3(filename, filepath);
		
		this.log('Playing annoucement file - end');

		this.log('Deleting annoucement file - start');
		const deleteFilePromise = new Promise((resolve, reject) => {
			s.unlink(filepath, (err) => {
				this.log('Deleting annoucement file - end');
				if (err) {
					reject(err);
				}

				resolve();
			});
		});

		await deleteFilePromise;
	}
}



module.exports = MyApp;