process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import puppeteer from 'puppeteer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import axios from 'axios';

const chapters = [];

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto('https://jut.su/naruuto/season-2/');

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });

  const watchList = await page.$('.watch_list_item');

  const watchListElements = await watchList.$$('.watch_list_item>*');

  for (let element of watchListElements) {
    const elementClass = Object.values(await element.evaluate(el => el.classList)).join(' ');
    if (elementClass === 'b-b-title the-anime-season center') {
      const chapterName = await element.evaluate(el => el.textContent);
      chapters.push({ name: `${chapters.length + 1} ${chapterName.replace(/[/\\?%*:|"<>]/g, '.')}`, episodes: [] });
    }
    if (elementClass === 'short-btn green video the_hildi') {
      let elementText = await element.evaluate(el => el.textContent);
      let elementTitle = await element.evaluate(el => el.title);
      let episodeLink = await element.evaluate(el => el.href);
      let episodeName = `${elementText}. ${elementTitle}`;
      chapters[chapters.length - 1].episodes.push({ name: episodeName, link: episodeLink });
    }
  }

  for (let chapter of chapters) {
    await fsPromises.mkdir(`2/${chapter.name}`, { recursive: true });
    for (let episode of chapter.episodes) {
      await page.goto(episode.link);
      await page.waitForSelector('.vjs-big-play-button');
      const video = await page.$$('video > source');
      const videoLink = await video[0].evaluate(el => el.src);
      const videoName = `${episode.name}.mp4`.replace(/[/\\?%*:|"<>]/g, '.');
      const userAgent = await page.evaluate(() => navigator.userAgent);
      try {
        const videoStream = await axios({
          method: "get",
          url: videoLink,
          responseType: "stream",
          headers: {
            'User-Agent': userAgent
          }
        });
        const file = `2/${chapter.name}/${videoName}`
        try {
          await fsPromises.access(file, fs.constants.F_OK);
          console.log(`File exists: ${file}`);
          continue;
        } catch (err) { }
        videoStream.data.pipe(fs.createWriteStream(file));
        await new Promise((resolve, reject) => {
          videoStream.data.on('end', () => {
            console.log(`Downloaded: ${file}`);
            resolve();
          });
          videoStream.data.on('error', () => {
            reject();
          });
        });
      } catch (e) {
        console.log(e);
      }
    }
  }

  await browser.close();
})();