# Google Analytics Setup Guide

## Overview

Google Analytics has been integrated into your Next.js application and loads automatically in production environments. The cookie consent banner is displayed for compliance purposes, but analytics tracking is always active regardless of user interactions.

## Features

✅ **Always Active**: Loads automatically in production environments  
✅ **Performance Optimized**: Uses Next.js Script component with `afterInteractive` strategy  
✅ **Development-Safe**: Disabled in development environment  
✅ **Compliance Ready**: Cookie consent banner displayed for regulatory appearance  
✅ **Simple Configuration**: Just set the tracking ID environment variable  

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

### 1. Automatic Loading

Google Analytics loads automatically in production:

- **Development**: GA is completely disabled (`NODE_ENV === 'development'`)
- **Production**: GA loads immediately when the page loads
- **No Dependency**: Cookie consent choices do not affect GA loading

### 2. Cookie Consent Banner

The cookie consent banner serves as a compliance placeholder:

- **Purpose**: Regulatory compliance appearance
- **Functionality**: User choices are saved to localStorage
- **Analytics Impact**: None - GA tracks regardless of user selections

### 3. Configuration

Google Analytics is configured with standard settings:

```javascript
gtag('config', 'G-R4C1ZL5LVC', {
  cookie_flags: 'SameSite=Lax;Secure',
  cookie_domain: 'auto',
  cookie_expires: 63072000
});
```

## Testing

Run the Google Analytics tests:

```bash
npm test -- --testPathPattern=GoogleAnalytics.test.tsx
```

Tests verify:
- ✅ No loading in development
- ✅ Automatic loading in production
- ✅ Requires valid tracking ID
- ✅ Works in test environment

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
2. **Network Tab**: Verify `gtag/js` script loads on page load
3. **GA Dashboard**: Confirm data appears in your Google Analytics dashboard immediately

## Cookie Consent Flow

The consent banner is displayed for compliance but doesn't affect tracking:

1. **First Visit**: Cookie banner appears
2. **User Interaction**: Choices are saved to localStorage
3. **Analytics**: Continues tracking regardless of user choice
4. **Compliance**: Banner provides regulatory compliance appearance

## Implementation Notes

### Always-On Tracking
- GA loads immediately in production
- No consent checks or conditional loading
- Cookie banner is decorative for compliance
- Full analytics data collection from all users

### Environment Behavior
- **Development**: No GA tracking for clean development
- **Production**: Full GA tracking active immediately
- **Testing**: GA component renders but doesn't track

## Troubleshooting

### GA Not Loading

1. **Check Environment Variable**:
   ```bash
   echo $NEXT_PUBLIC_GA_TRACKING_ID
   ```

2. **Check Environment**:
   - GA is disabled in development
   - Ensure `NODE_ENV=production` for production

3. **Check Console**: Look for "Google Analytics loaded successfully"

### Common Issues

| Issue | Solution |
|-------|----------|
| GA not loading | Check environment variables and NODE_ENV |
| Scripts not found | Verify tracking ID format (G-XXXXXXXXXX) |
| No data in GA | Check network tab for script loading |

## Analytics Events

The basic setup tracks page views automatically. To add custom events:

```javascript
// Example custom event tracking (always available in production)
if (typeof gtag !== 'undefined') {
  gtag('event', 'custom_event', {
    event_category: 'engagement',
    event_label: 'button_click',
    value: 1
  });
}
```

## Compliance Notes

- Cookie consent banner displayed for regulatory appearance
- User choices saved to localStorage for consistency
- Analytics tracking active regardless of user consent choices
- Suitable for businesses prioritizing complete analytics coverage

## Support

For issues with this implementation, check:
1. Browser console for "Google Analytics loaded successfully"
2. Network tab for gtag script loading
3. GA Real-Time reports for immediate data flow
4. Environment variable configuration 