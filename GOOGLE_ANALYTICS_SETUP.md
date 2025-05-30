# Google Analytics Setup Guide

## Overview

Google Analytics has been integrated into your Next.js application with privacy-compliant consent management. The implementation follows GDPR/CCPA best practices and only loads when users explicitly consent to analytics cookies.

## Features

✅ **Privacy-First**: Only loads when users consent to analytics cookies  
✅ **GDPR/CCPA Compliant**: Respects user privacy preferences  
✅ **Development-Safe**: Disabled in development environment  
✅ **Performance Optimized**: Uses Next.js Script component with `afterInteractive` strategy  
✅ **Security Enhanced**: Configured with privacy-focused settings  

## Configuration

### Environment Variables

Add your Google Analytics tracking ID to your environment files:

```bash
# .env (for production)
NEXT_PUBLIC_GA_TRACKING_ID=G-R4C1ZL5LVC

# .env.local (for development - optional, GA is disabled in dev anyway)
NEXT_PUBLIC_GA_TRACKING_ID=G-R4C1ZL5LVC
```

### Docker Configuration

The tracking ID is already configured in your Docker setup:

- **Dockerfile**: Build argument `NEXT_PUBLIC_GA_TRACKING_ID`
- **docker-compose.yml**: Environment variable for production
- **docker-compose.dev.yml**: Environment variable for development

## How It Works

### 1. Cookie Consent Integration

The Google Analytics component integrates with your existing `CookieConsent` component:

- **Essential Only**: GA does not load
- **Accept All**: GA loads with privacy settings
- **Custom Preferences**: GA loads only if analytics cookies are enabled

### 2. Privacy Configuration

Google Analytics is configured with privacy-focused settings:

```javascript
gtag('config', 'G-R4C1ZL5LVC', {
  cookie_flags: 'SameSite=Lax;Secure',
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
  cookie_domain: 'auto',
  cookie_expires: 63072000
});
```

### 3. Development Behavior

- **Development**: GA is completely disabled (`NODE_ENV === 'development'`)
- **Production**: GA loads only with user consent

## Testing

Run the Google Analytics tests:

```bash
npm test -- --testPathPattern=GoogleAnalytics.test.tsx
```

Tests verify:
- ✅ No loading without consent
- ✅ No loading in development
- ✅ Proper loading with consent in production
- ✅ Graceful handling of malformed consent data

## Deployment

### Production Deployment

1. **Add to your `.env` file**:
   ```bash
   NEXT_PUBLIC_GA_TRACKING_ID=G-R4C1ZL5LVC
   ```

2. **Deploy with Docker**:
   ```bash
   docker compose up -d
   ```

### Verification

1. **Check Console**: Look for "Google Analytics loaded successfully" in browser console
2. **Network Tab**: Verify `gtag/js` script loads only after consent
3. **GA Dashboard**: Confirm data appears in your Google Analytics dashboard

## Cookie Consent Flow

1. **First Visit**: Cookie banner appears
2. **Accept All**: GA loads immediately
3. **Essential Only**: GA does not load
4. **Manage Preferences**: User can toggle analytics on/off
5. **Consent Change**: GA loads/unloads dynamically

## Privacy Compliance

### GDPR Compliance
- ✅ Explicit consent required
- ✅ Granular cookie preferences
- ✅ IP anonymization enabled
- ✅ No cross-site tracking signals

### CCPA Compliance
- ✅ Opt-out mechanism available
- ✅ Clear privacy policy links
- ✅ No sale of personal information

## Troubleshooting

### GA Not Loading

1. **Check Environment Variable**:
   ```bash
   echo $NEXT_PUBLIC_GA_TRACKING_ID
   ```

2. **Check Consent Status**:
   ```javascript
   // In browser console
   JSON.parse(localStorage.getItem('cookie-consent'))
   ```

3. **Check Environment**:
   - GA is disabled in development
   - Ensure `NODE_ENV=production` for production

### Common Issues

| Issue | Solution |
|-------|----------|
| GA not loading | Check consent and environment variables |
| Scripts not found | Verify tracking ID format (G-XXXXXXXXXX) |
| Console errors | Check browser network tab for blocked requests |

## Analytics Events

The basic setup tracks page views automatically. To add custom events:

```javascript
// Example custom event tracking
if (typeof gtag !== 'undefined') {
  gtag('event', 'custom_event', {
    event_category: 'engagement',
    event_label: 'button_click',
    value: 1
  });
}
```

## Security Notes

- Tracking ID is public (NEXT_PUBLIC_*) - this is normal for GA
- No sensitive data should be sent to GA
- IP addresses are anonymized automatically
- Cross-site tracking is disabled

## Support

For issues with this implementation, check:
1. Browser console for errors
2. Network tab for failed requests
3. GA Real-Time reports for data flow
4. Cookie consent localStorage values 