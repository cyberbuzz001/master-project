#!/usr/bin/env node
/**
 * WhatsApp Business Tools MCP Server
 * Connects Antigravity to WhatsApp Business Cloud API v21.0
 */

const readline = require('readline');
const https = require('https');

const DEFAULT_TOKEN = process.env.ADVISORY_WHATSAPP_META_TOKEN ||
  process.env.WHATSAPP_TOKEN ||
  '';

const DEFAULT_PHONE_ID = process.env.ADVISORY_WHATSAPP_PHONE_NUMBER_ID ||
  process.env.WHATSAPP_PHONE_NUMBER_ID ||
  '1059520793907690';

const DEFAULT_WABA_ID = process.env.ADVISORY_WHATSAPP_WABA_ID ||
  process.env.WHATSAPP_WABA_ID ||
  '930969066677526';

function metaRequest(method, endpoint, body = null, token = DEFAULT_TOKEN) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: endpoint.startsWith('/v21.0') ? endpoint : `/v21.0${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

const TOOLS = [
  {
    name: 'whatsapp_get_phone_number_details',
    description: 'Get live registration status, verified name, quality rating, and messaging tier of the WhatsApp phone number from Meta Cloud API.',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: {
          type: 'string',
          description: 'Meta Phone Number ID. Defaults to configured Expert Stocks phone ID (1059520793907690).'
        }
      }
    }
  },
  {
    name: 'whatsapp_get_business_profile',
    description: 'Retrieve the WhatsApp Business profile details (about text, address, description, email, websites, vertical).',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: {
          type: 'string',
          description: 'Meta Phone Number ID. Defaults to configured Expert Stocks phone ID.'
        }
      }
    }
  },
  {
    name: 'whatsapp_update_business_profile',
    description: 'Update the WhatsApp Business profile on Meta Cloud API (about text, address, description, email, websites, vertical).',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: { type: 'string', description: 'Meta Phone Number ID.' },
        about: { type: 'string', description: 'Status / about line (max 139 chars)' },
        description: { type: 'string', description: 'Business description (max 512 chars)' },
        email: { type: 'string', description: 'Contact email address' },
        websites: { type: 'array', items: { type: 'string' }, description: 'Website URLs (max 2)' },
        vertical: { type: 'string', description: 'Business industry (e.g. FINANCE, PROFESSIONAL_SERVICES)' }
      }
    }
  },
  {
    name: 'whatsapp_send_text_message',
    description: 'Send a direct WhatsApp text message to a user phone number (with country code, e.g. 919876543210).',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number with country code, without + or spaces (e.g. 919876543210).' },
        message: { type: 'string', description: 'Text message content.' },
        preview_url: { type: 'boolean', description: 'Whether to show web link preview if links are in text.' }
      },
      required: ['to', 'message']
    }
  },
  {
    name: 'whatsapp_send_template_message',
    description: 'Send a pre-approved Meta WhatsApp template message to a user phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number with country code (e.g. 919876543210).' },
        template_name: { type: 'string', description: 'Name of the approved template in Meta Business Manager.' },
        language_code: { type: 'string', description: 'Language code (e.g. en, en_US, hi). Defaults to en.' },
        components: { type: 'array', description: 'Optional template parameter components (header, body, button parameters).' }
      },
      required: ['to', 'template_name']
    }
  },
  {
    name: 'whatsapp_send_interactive_buttons',
    description: 'Send interactive quick-reply buttons to a user.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number with country code (e.g. 919876543210).' },
        body_text: { type: 'string', description: 'Message body text.' },
        buttons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique button callback ID' },
              title: { type: 'string', description: 'Button display label (max 20 chars)' }
            },
            required: ['id', 'title']
          },
          description: 'Buttons (up to 3 buttons)'
        }
      },
      required: ['to', 'body_text', 'buttons']
    }
  },
  {
    name: 'whatsapp_request_code',
    description: 'Request a verification code via SMS or VOICE to register the WhatsApp Business phone number on Meta Cloud API.',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: { type: 'string', description: 'Meta Phone Number ID.' },
        code_method: { type: 'string', enum: ['SMS', 'VOICE'], description: 'Method to receive code (SMS or VOICE).' },
        language: { type: 'string', description: 'Language for code delivery (e.g. en_US, hi_IN). Defaults to en_US.' }
      },
      required: ['code_method']
    }
  },
  {
    name: 'whatsapp_verify_code',
    description: 'Submit the verification code received via SMS/VOICE to verify the WhatsApp Business phone number on Meta Cloud API.',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: { type: 'string', description: 'Meta Phone Number ID.' },
        code: { type: 'string', description: 'Verification OTP code received via SMS or Voice.' }
      },
      required: ['code']
    }
  },
  {
    name: 'whatsapp_register_phone_number',
    description: 'Register the phone number for WhatsApp Cloud API after verification, setting a 6-digit two-step verification PIN.',
    inputSchema: {
      type: 'object',
      properties: {
        phone_number_id: { type: 'string', description: 'Meta Phone Number ID.' },
        pin: { type: 'string', description: '6-digit registration PIN for two-step verification.' }
      },
      required: ['pin']
    }
  }
];

async function handleToolCall(name, args) {
  const phoneId = args?.phone_number_id || DEFAULT_PHONE_ID;

  switch (name) {
    case 'whatsapp_get_phone_number_details': {
      const res = await metaRequest('GET', `/${phoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,name_status,status,account_mode`);
      return res;
    }

    case 'whatsapp_get_business_profile': {
      const res = await metaRequest('GET', `/${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`);
      return res;
    }

    case 'whatsapp_update_business_profile': {
      const payload = {
        messaging_product: 'whatsapp'
      };
      if (args.about) payload.about = args.about;
      if (args.description) payload.description = args.description;
      if (args.email) payload.email = args.email;
      if (args.websites) payload.websites = args.websites;
      if (args.vertical) payload.vertical = args.vertical;

      const res = await metaRequest('POST', `/${phoneId}/whatsapp_business_profile`, payload);
      return res;
    }

    case 'whatsapp_send_text_message': {
      const cleanPhone = String(args.to).replace(/[^0-9]/g, '');
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: args.preview_url !== false,
          body: args.message
        }
      };
      const res = await metaRequest('POST', `/${phoneId}/messages`, payload);
      return res;
    }

    case 'whatsapp_send_template_message': {
      const cleanPhone = String(args.to).replace(/[^0-9]/g, '');
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: args.template_name,
          language: {
            code: args.language_code || 'en'
          }
        }
      };
      if (args.components && Array.isArray(args.components)) {
        payload.template.components = args.components;
      }
      const res = await metaRequest('POST', `/${phoneId}/messages`, payload);
      return res;
    }

    case 'whatsapp_send_interactive_buttons': {
      const cleanPhone = String(args.to).replace(/[^0-9]/g, '');
      const interactiveButtons = (args.buttons || []).slice(0, 3).map((b) => ({
        type: 'reply',
        reply: {
          id: b.id,
          title: b.title.slice(0, 20)
        }
      }));

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: args.body_text
          },
          action: {
            buttons: interactiveButtons
          }
        }
      };
      const res = await metaRequest('POST', `/${phoneId}/messages`, payload);
      return res;
    }

    case 'whatsapp_request_code': {
      const payload = {
        code_method: args.code_method || 'SMS',
        language: args.language || 'en_US'
      };
      const res = await metaRequest('POST', `/${phoneId}/request_code`, payload);
      return res;
    }

    case 'whatsapp_verify_code': {
      const payload = {
        code: String(args.code).trim()
      };
      const res = await metaRequest('POST', `/${phoneId}/verify_code`, payload);
      return res;
    }

    case 'whatsapp_register_phone_number': {
      const payload = {
        messaging_product: 'whatsapp',
        pin: String(args.pin).trim()
      };
      const res = await metaRequest('POST', `/${phoneId}/register`, payload);
      return res;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Setup MCP standard JSON-RPC protocol over STDIN/STDOUT
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line || !line.trim()) return;

  try {
    const request = JSON.parse(line.trim());
    const { id, method, params } = request;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'whatsapp-business',
            version: '1.0.0'
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'notifications/initialized') {
      // No response required for notification
      return;
    }

    if (method === 'ping') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params;
      try {
        const output = await handleToolCall(name, toolArgs);
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(output, null, 2)
              }
            ],
            isError: output.status >= 400
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing ${name}: ${err.message}`
              }
            ],
            isError: true
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
      return;
    }

    // Default unhandled method
    if (id !== undefined) {
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method '${method}' not found`
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    // Malformed JSON
  }
});
