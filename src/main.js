/**키워드로 검색해서 나온 이미지를 원하는 사이즈로 리사이징해서 돌려주는 서버 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { createApi } = require("unsplash-js");
const { default: fetch } = require("node-fetch");
const { pipeline } = require("stream");
const { promisify } = require("util");

const sharp = require("sharp");
require("dotenv").config();

const unsplash = createApi({
  accessKey: process.env.ACCESS_KEY,
  fetch,
});

/**
 * @param {string} query
 */
async function searchImg(query) {
  const result = await unsplash.search.getPhotos({ query });

  if (!result.response) {
    throw new Error("Fail to find image");
  }

  const image = result.response.results[0];

  if (!image) {
    throw new Error("no image");
  }

  return {
    description: image.description || image.alt_description,
    url: image.urls.regular,
  };
}
/**
 * 이미지를 splash에서 검색하거나, 이미 있다면 캐시된 이미지를 리턴
 * @param {string} query
 */
async function getCachedImgOrSearchedImg(query) {
  const imageFilePath = path.resolve(__dirname, `../images/${query}`);

  if (fs.existsSync(imageFilePath)) {
    return {
      message: `Returning Cached Image : ${query}`,
      stream: fs.createReadStream(imageFilePath),
    };
  }

  const result = await searchImg(query);
  const resp = await fetch(result.url);

  await promisify(pipeline)(resp.body, fs.createWriteStream(imageFilePath));

  return {
    message: `Returning New Image : ${query}`,
    stream: fs.createReadStream(imageFilePath),
  };
}

/**
 * @param {string} url
 */
function convertURLtoImageInfo(url) {
  function getSearchParam(name, defaultValue) {
    const str = urlObj.searchParams.get(name);
    return str ? parseInt(str, 10) : defaultValue;
  }

  const urlObj = new URL(url, "http://localhost:5000");
  const width = getSearchParam("width", 400);
  const height = getSearchParam("height", 400);
  return {
    query: urlObj.pathname.slice(1),
    width,
    height,
  };
}

const server = http.createServer((req, res) => {
  async function main() {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Need URL");
      return;
    }

    const { query, width, height } = convertURLtoImageInfo(req.url);

    try {
      const { message, stream } = await getCachedImgOrSearchedImg(query);

      console.log(message);
      await promisify(pipeline)(
        stream,
        sharp().resize(width, height, { fit: "cover" }).png(),
        res
      );
    } catch {
      res.statusCode = 400;
      res.end("qweqwe");
    }
  }

  main();
});

server.listen(5000, () => {
  console.log("server is listening");
});
