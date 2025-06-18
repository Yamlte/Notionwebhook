const { downloadArticle } = require('./downloadArticle');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    console.log("Request Body:", body);

    if (body.verification_token) {
      console.log('✅ Верификация вебхука');
      return {
        statusCode: 200,
        body: JSON.stringify(body),
      };
    }

    const eventType = body.type;
    const pageId = body.data?.id || body.entity?.id || body.page_id;

    if (pageId && (
      eventType?.startsWith('database.') ||
      ['pages.update', 'page.created', 'page.properties_updated'].includes(eventType)
    )) {
      console.log(`🔔 Событие: ${eventType} (pageId: ${pageId})`);
      await downloadArticle(pageId, body);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'OK' }),
    };
  } catch (error) {
    console.error('❌ Ошибка:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Ошибка обработки вебхука' }),
    };
  }
};

