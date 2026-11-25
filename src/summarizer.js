import OpenAI from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

// Upper bounds so that a single request can't get expensive (the app has no authentication)
const MAX_INPUT_CHARS = 20_000;
const MAX_OUTPUT_TOKENS = 1_000;

export class SummaryError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function credentialFor(clientId) {
  // Same mechanism as for the storage, but with its own identity:
  // the pod's service account token is exchanged for a token of the identity with this
  // client ID. That works because this identity has its own federated credential
  // for the same service account.
  return clientId
    ? new DefaultAzureCredential({ workloadIdentityClientId: clientId, managedIdentityClientId: clientId })
    : new DefaultAzureCredential();
}

export class Summarizer {
  constructor({ baseURL, deployment, clientId }, { credential = credentialFor(clientId), client } = {}) {
    this.deployment = deployment;
    this.client = client ?? new OpenAI({
      baseURL,
      // No API key: the "key" is an Entra ID token that is fetched fresh as needed
      apiKey: getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default'),
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  async summarize({ title, content }) {
    const text = (content ?? '').trim();
    if (!text) throw new SummaryError('The note is empty, there is nothing to summarize', 400);

    const response = await this.client.chat.completions.create({
      model: this.deployment, // with Azure OpenAI: the name of the deployment
      messages: [
        {
          role: 'system',
          content:
            'You summarize notes. Reply with 2 to 4 short sentences in the language of the note. ' +
            'Use only information contained in the note.',
        },
        { role: 'user', content: `Title: ${title}\n\n${text.slice(0, MAX_INPUT_CHARS)}` },
      ],
      max_completion_tokens: MAX_OUTPUT_TOKENS,
    });

    const summary = response.choices?.[0]?.message?.content?.trim();
    if (!summary) throw new SummaryError('The model did not return a summary', 502);
    return summary;
  }
}
