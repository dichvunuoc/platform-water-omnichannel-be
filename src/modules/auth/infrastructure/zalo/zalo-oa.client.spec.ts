import { ZaloOaClient } from './zalo-oa.client';

const makeConfig = (vars: Record<string, string>) =>
  ({
    get: (key: string) => vars[key],
  }) as any;

describe('ZaloOaClient', () => {
  it('is unconfigured when OA credentials are missing', () => {
    const client = new ZaloOaClient(makeConfig({}));
    expect(client.configured).toBe(false);
  });

  it('is configured when app id/secret/refresh token are set', () => {
    const client = new ZaloOaClient(
      makeConfig({
        ZALO_OA_ID: 'oa-id',
        ZALO_OA_APP_SECRET: 'secret',
        ZALO_OA_REFRESH_TOKEN: 'rt',
      }),
    );
    expect(client.configured).toBe(true);
  });

  it('sendOtp falls back to dev log (no fetch) when unconfigured or template missing', async () => {
    const client = new ZaloOaClient(makeConfig({}));
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(client.sendOtp('0912345678', '123456')).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sendOtp calls the OA API when configured + template set', async () => {
    const client = new ZaloOaClient(
      makeConfig({
        ZALO_OA_ID: 'oa-id',
        ZALO_OA_APP_SECRET: 'secret',
        ZALO_OA_REFRESH_TOKEN: 'rt',
        ZALO_OA_OTP_TEMPLATE_ID: 'tpl-otp',
        ZALO_OA_BASE_URL: 'https://openapi.zaloapp.com',
      }),
    );
    const fetchMock = jest
      .fn()
      // first call = token refresh, second call = message send
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'AT-123', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => '' });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    await client.sendOtp('0912345678', '123456');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // message send call hits the OA phonenumber endpoint with the template
    const sendCall = fetchMock.mock.calls[1];
    expect(String(sendCall[1]?.headers?.access_token)).toBe('AT-123');
    fetchMock.mockRestore();
  });
});
