# How to Upload Your Custom Logo to Juice Junkies Store

## Step 1: Prepare Your Logo File

### Recommended Specifications:
- **Format:** PNG (with transparent background) or SVG (vector)
- **Size:** 400x120px to 600x180px for best quality
- **Aspect Ratio:** Roughly 3:1 or 4:1 (wider than tall)
- **Background:** Transparent for best integration
- **Colors:** Should work well with dark backgrounds

### File Naming:
- Name your file: `juice-junkies-logo.png` or `juice-junkies-logo.svg`
- Use lowercase letters and hyphens only

## Step 2: Upload the Logo

1. **Navigate to your project folder:**
   ```
   juice-wrld-store/public/
   ```

2. **Copy your logo file** into the `public` folder
   - The file should be at: `juice-wrld-store/public/juice-junkies-logo.png`

## Step 3: Activate Your Custom Logo

1. **Open the file:** `src/components/Logo.tsx`

2. **Change line 16** from:
   ```typescript
   const hasCustomLogo = false
   ```
   **To:**
   ```typescript
   const hasCustomLogo = true
   ```

3. **Update the filename** (line 23) if needed:
   ```typescript
   src="/juice-junkies-logo.png" // Make sure this matches your filename
   ```

## Step 4: Adjust Logo Size (Optional)

If your logo appears too big or small, you can adjust the sizes in `src/components/Logo.tsx`:

```typescript
const sizeConfig = {
  small: { width: 120, height: 40 },   // Navigation on mobile
  medium: { width: 180, height: 60 },  // Main navigation
  large: { width: 240, height: 80 }    // Special sections
}
```

## Step 5: Test Different Variants

Your logo will automatically appear in:
- ✅ **Header navigation** (medium size)
- ✅ **Footer** (small size)
- ✅ **Hero sections** (large size)

## Logo Placement Examples

### Current Logo Locations:
1. **Top navigation bar** - Medium size with hover animation
2. **Footer** - Small size (when we add footer)
3. **Loading screens** - Large animated version

### Additional Placement Options:
- **Favicon** (browser tab icon)
- **Social media sharing image**
- **Email signatures**
- **Product watermarks**

## Troubleshooting

### Logo Not Showing?
1. Check the file path: `public/juice-junkies-logo.png`
2. Verify the filename matches exactly in `Logo.tsx`
3. Make sure `hasCustomLogo = true`
4. Clear browser cache and refresh

### Logo Looks Blurry?
1. Use a higher resolution image (2x or 3x size)
2. Try SVG format for crisp vector graphics
3. Ensure the original image is high quality

### Logo Colors Don't Match?
1. Create versions for dark/light backgrounds
2. Add CSS filters in the Logo component
3. Use transparent PNG with white/colored elements

## Advanced Customization

### Multiple Logo Variants:
```typescript
// In Logo.tsx, you can add different versions:
const logoSrc = variant === 'dark'
  ? '/juice-junkies-logo-dark.png'
  : '/juice-junkies-logo-light.png'
```

### Animated Logo Effects:
```typescript
// Add special effects to your logo:
<motion.div
  whileHover={{
    scale: 1.1,
    filter: "drop-shadow(0 0 20px #39ff14)"
  }}
>
  <Image src="/your-logo.png" ... />
</motion.div>
```

## Next Steps After Upload

1. **Test on different screen sizes** (mobile, tablet, desktop)
2. **Check logo visibility** on all backgrounds
3. **Verify loading speed** (optimize file size if needed)
4. **Create favicon** from logo for browser tabs
5. **Add to social media meta tags**

Your logo will be live immediately after saving the changes! 🎉