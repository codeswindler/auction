import { z } from 'zod';

export const api = {
  ussd: {
    handle: {
      method: 'GET' as const,
      path: '/api/ussd',
      input: z.object({
        MSISDN: z.string(),
        SESSIONID: z.string(),
        USSDCODE: z.string(),
        INPUT: z.string(),
      }),
      responses: {
        200: z.string(),
      },
    },
    simulator: {
      method: 'POST' as const,
      path: '/api/ussd/simulator',
      input: z.object({
        phoneNumber: z.string(),
        text: z.string(),
        sessionId: z.string(),
        ussdCode: z.string().optional(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
          type: z.enum(['CON', 'END']),
        }),
      },
    },
  },
  users: {
    get: {
      method: 'GET' as const,
      path: '/api/users/:phoneNumber',
      responses: {
        200: z.object({
          phoneNumber: z.string(),
          balance: z.string(),
          loanLimit: z.string(),
        }).nullable(),
      },
    }
  },
  admin: {
    users: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/users',
        responses: {
          200: z.array(z.object({
            id: z.number(),
            phoneNumber: z.string(),
            idNumber: z.string().nullable(),
            balance: z.string(),
            loanLimit: z.string(),
            hasActiveLoan: z.boolean(),
          })),
        },
      },
      detail: {
        method: 'GET' as const,
        path: '/api/admin/users/:id',
        responses: {
          200: z.object({
            id: z.number(),
            phoneNumber: z.string(),
            idNumber: z.string().nullable(),
            balance: z.string(),
            loanLimit: z.string(),
            hasActiveLoan: z.boolean(),
          }).nullable(),
        },
      },
    },
    transactions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/transactions',
        responses: {
          200: z.array(z.object({
            id: z.number(),
            userId: z.number(),
            type: z.string(),
            amount: z.string(),
            reference: z.string(),
            status: z.string(),
            createdAt: z.string().or(z.date()).optional(),
          })),
        },
      },
    },
    auctions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/auctions',
        responses: {
          200: z.array(z.object({
            id: z.number(),
            title: z.string(),
            amount: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          })),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/auctions',
        input: z.object({
          title: z.string().min(1),
          amount: z.number().positive(),
          isActive: z.boolean().optional(),
        }),
        responses: {
          200: z.object({
            id: z.number(),
            title: z.string(),
            amount: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          }),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/auctions/:id',
        input: z.object({
          title: z.string().min(1).optional(),
          amount: z.number().positive().optional(),
          isActive: z.boolean().optional(),
        }),
        responses: {
          200: z.object({
            id: z.number(),
            title: z.string(),
            amount: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          }),
        },
      },
    },
    campaigns: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/campaigns',
        responses: {
          200: z.array(z.object({
            id: z.number(),
            name: z.string(),
            menuTitle: z.string(),
            rootPrompt: z.string(),
            bidFeeMin: z.number().or(z.string()),
            bidFeeMax: z.number().or(z.string()),
            bidFeePrompt: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          })),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/campaigns',
        input: z.object({
          name: z.string().min(1),
          menuTitle: z.string().min(1),
          rootPrompt: z.string().min(1),
          bidFeeMin: z.number().min(0).optional(),
          bidFeeMax: z.number().min(0).optional(),
          bidFeePrompt: z.string().min(1).optional(),
          isActive: z.boolean().optional(),
        }),
        responses: {
          200: z.object({
            id: z.number(),
            name: z.string(),
            menuTitle: z.string(),
            rootPrompt: z.string(),
            bidFeeMin: z.number().or(z.string()),
            bidFeeMax: z.number().or(z.string()),
            bidFeePrompt: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          }),
        },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/campaigns/:id',
        input: z.object({
          name: z.string().min(1).optional(),
          menuTitle: z.string().min(1).optional(),
          rootPrompt: z.string().min(1).optional(),
          bidFeeMin: z.number().min(0).optional(),
          bidFeeMax: z.number().min(0).optional(),
          bidFeePrompt: z.string().min(1).optional(),
          isActive: z.boolean().optional(),
        }),
        responses: {
          200: z.object({
            id: z.number(),
            name: z.string(),
            menuTitle: z.string(),
            rootPrompt: z.string(),
            bidFeeMin: z.number().or(z.string()),
            bidFeeMax: z.number().or(z.string()),
            bidFeePrompt: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          }),
        },
      },
      activate: {
        method: 'POST' as const,
        path: '/api/admin/campaigns/:id/activate',
        responses: {
          200: z.object({
            id: z.number(),
            name: z.string(),
            menuTitle: z.string(),
            rootPrompt: z.string(),
            bidFeeMin: z.number().or(z.string()),
            bidFeeMax: z.number().or(z.string()),
            bidFeePrompt: z.string(),
            isActive: z.boolean(),
            createdAt: z.string().or(z.date()).optional(),
          }),
        },
      },
      nodes: {
        list: {
          method: 'GET' as const,
          path: '/api/admin/campaigns/:id/nodes',
          responses: {
            200: z.array(z.object({
              id: z.number(),
              campaignId: z.number(),
              parentId: z.number().nullable(),
              label: z.string(),
              prompt: z.string().nullable().optional(),
              actionType: z.string().nullable().optional(),
              actionPayload: z.string().nullable().optional(),
              sortOrder: z.number().optional(),
              isActive: z.boolean(),
              createdAt: z.string().or(z.date()).optional(),
            })),
          },
        },
        create: {
          method: 'POST' as const,
          path: '/api/admin/campaigns/:id/nodes',
          input: z.object({
            parentId: z.number().nullable().optional(),
            label: z.string().min(1),
            prompt: z.string().optional(),
            actionType: z.string().optional(),
            actionPayload: z.string().optional(),
            sortOrder: z.number().optional(),
            isActive: z.boolean().optional(),
          }),
          responses: {
            200: z.object({
              id: z.number(),
              campaignId: z.number(),
              parentId: z.number().nullable(),
              label: z.string(),
              prompt: z.string().nullable().optional(),
              actionType: z.string().nullable().optional(),
              actionPayload: z.string().nullable().optional(),
              sortOrder: z.number().optional(),
              isActive: z.boolean(),
              createdAt: z.string().or(z.date()).optional(),
            }),
          },
        },
        update: {
          method: 'PATCH' as const,
          path: '/api/admin/campaigns/:id/nodes/:nodeId',
          input: z.object({
            parentId: z.number().nullable().optional(),
            label: z.string().min(1).optional(),
            prompt: z.string().optional(),
            actionType: z.string().optional(),
            actionPayload: z.string().optional(),
            sortOrder: z.number().optional(),
            isActive: z.boolean().optional(),
          }),
          responses: {
            200: z.object({
              id: z.number(),
              campaignId: z.number(),
              parentId: z.number().nullable(),
              label: z.string(),
              prompt: z.string().nullable().optional(),
              actionType: z.string().nullable().optional(),
              actionPayload: z.string().nullable().optional(),
              sortOrder: z.number().optional(),
              isActive: z.boolean(),
              createdAt: z.string().or(z.date()).optional(),
            }),
          },
        },
        remove: {
          method: 'DELETE' as const,
          path: '/api/admin/campaigns/:id/nodes/:nodeId',
          responses: {
            200: z.object({
              id: z.number(),
              campaignId: z.number(),
              parentId: z.number().nullable(),
              label: z.string(),
              prompt: z.string().nullable().optional(),
              actionType: z.string().nullable().optional(),
              actionPayload: z.string().nullable().optional(),
              sortOrder: z.number().optional(),
              isActive: z.boolean(),
              createdAt: z.string().or(z.date()).optional(),
            }),
          },
        },
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
