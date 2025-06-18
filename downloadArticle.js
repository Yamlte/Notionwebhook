const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client } = require('@notionhq/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const s3 = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY,
    secretAccessKey: process.env.YC_SECRET_KEY,
  },
});

const BUCKET = process.env.YC_BUCKET_NAME;

async function uploadToBucket(key, content, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: content,
    ContentType: contentType,
  });

  await s3.send(command);
  console.log(`☁️ Uploaded to ${key}`);
}

async function downloadFile(url, token) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
    },
  });
  return response.data;
}

async function downloadArticle(pageId, webhookData = null) {
  try {
    const cleanPageId = pageId.replace(/-/g, '');
    const prefix = `notion_articles/${cleanPageId}/`;

    const page = await notion.pages.retrieve({ page_id: pageId });
    await uploadToBucket(`${prefix}page.json`, JSON.stringify(page, null, 2), 'application/json');

    const blocks = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
    await uploadToBucket(`${prefix}blocks.json`, JSON.stringify(blocks, null, 2), 'application/json');

    if (webhookData) {
      await uploadToBucket(`${prefix}webhook.json`, JSON.stringify(webhookData, null, 2), 'application/json');
    }

    let content = '';

    for (const block of blocks.results) {
      const type = block.type;
      const data = block[type];

      if (['image', 'file', 'pdf'].includes(type)) {
        let fileUrl = data?.external?.url || data?.file?.url;
        if (fileUrl) {
          const ext = path.extname(new URL(fileUrl).pathname) || '.bin';
          const filename = `${type}_${Date.now()}${ext}`;
          const fileData = await downloadFile(fileUrl, process.env.NOTION_TOKEN);
          await uploadToBucket(`${prefix}media/${filename}`, fileData, 'application/octet-stream');
        }
      }

      if (type === 'paragraph' && data?.rich_text?.length) {
        const text = data.rich_text.map(rt => rt.plain_text).join('');
        content += text + '\n\n';
      }
    }

    if (content.trim()) {
      await uploadToBucket(`${prefix}content.md`, content, 'text/markdown');
    }

    console.log(`🎉 Загружено в бакет: ${BUCKET}/${prefix}`);
  } catch (err) {
    console.error(`❌ Ошибка: ${err.message}`);
  }
}

module.exports = { downloadArticle };
