# User Flow Documentation

This document outlines the major user flows within the application. Each flow is described with a sequence of user actions and expected system responses.

## Table of Contents
- [User Registration](#user-registration)
- [User Login](#user-login)
- [Image Generation](#image-generation)
- [Video Generation](#video-generation)
- [Image Editing](#image-editing)
- [Custom Models Management](#custom-models-management)
- [Model Training](#model-training)
- [User Settings](#user-settings)
- [Gallery and Media Management](#gallery-and-media-management)
- [Billing and Subscriptions](#billing-and-subscriptions)
- [User Logout](#user-logout)

---

## User Registration

This flow describes how a new user creates an account in the application.

**Trigger:** User navigates to the registration page, typically by clicking a "Sign Up" or "Register" button.

### Steps

1.  **Navigate to Registration Page:**
    *   **Action:** User clicks on the "Sign Up" button or navigates directly to `/register`.
    *   **System Response:** The application displays the registration form.

2.  **Fill Registration Form:**
    *   **Action:** The user enters their email address, a chosen password, and optionally, their name.
    *   **Fields:**
        *   `Email` (required)
        *   `Password` (required)
        *   `Name` (optional)

3.  **Agree to Terms:**
    *   **Action:** The user must check the box to agree to the "Terms of Service" and "Privacy Policy."
    *   **System Response:** The "Create Account" button becomes enabled.

4.  **Submit Form:**
    *   **Action:** User clicks the "Create Account" button.
    *   **System Response:**
        *   The system validates the form data.
        *   Upon successful validation, a new user account is created.
        *   The user is redirected to the dashboard (`/dashboard`).
        *   A session is created, and the user is now logged in.

### Post-conditions

*   A new user record is created in the database.
*   The user is authenticated and has an active session.
*   The user is on the main dashboard page.

---

## User Login

This flow describes how an existing user signs into the application.

**Trigger:** User navigates to the login page, typically by clicking a "Login" or "Sign In" button.

### Steps

1.  **Navigate to Login Page:**
    *   **Action:** User clicks on the "Login" button or navigates directly to `/login`.
    *   **System Response:** The application displays the login form.

2.  **Fill Login Form:**
    *   **Action:** The user enters their registered email address and password.
    *   **Fields:**
        *   `Email` (required)
        *   `Password` (required)

3.  **Submit Form:**
    *   **Action:** User clicks the "Sign In" button.
    *   **System Response:**
        *   The system authenticates the user's credentials.
        *   Upon successful authentication, the user is redirected to the dashboard (`/dashboard`).
        *   A session is created, and the user is now logged in.

### Post-conditions

*   The user is authenticated and has an active session.
*   The user is on the main dashboard page.

---

## Image Generation

This flow describes how a user generates an image using the available models.

**Trigger:** User navigates to the "Generate" page from the dashboard.

### Steps

1.  **Navigate to Generate Page:**
    *   **Action:** User clicks on the "Generate" link in the navigation bar.
    *   **System Response:** The application displays the "Generate Images" page.

2.  **Configure Generation Settings:**
    *   **Action:** The user configures the parameters for the image generation.
    *   **Fields:**
        *   `Model Type`: User can select between "Base FLUX Models" or their own "Custom Models".
        *   `Base Model`: A dropdown to select the specific AI model.
        *   `Prompt`: A text area for the user to describe the desired image.
        *   `Style`: A dropdown to select a visual style for the image.
        *   `Aspect Ratio`: A dropdown to select the image's aspect ratio.
        *   `Seed` (optional): A field for a seed value to reproduce results.

3.  **Initiate Image Generation:**
    *   **Action:** User clicks the "Generate Image" button.
    *   **System Response:**
        *   The system deducts the corresponding credit amount from the user's account.
        *   A job is submitted to the backend to generate the image.
        *   The UI updates to show a progress indicator or a loading state.

4.  **View Generated Image:**
    *   **Action:** Once the generation is complete, the image is displayed on the page.
    *   **System Response:** The user can view the generated image and has options to download, edit, or delete it.

### Post-conditions

*   Credits are deducted from the user's account.
*   A new image record is created in the database, associated with the user.
*   The generated image is available in the user's gallery.

---

## Video Generation

This flow describes how a user generates a video from a text prompt or an image.

**Trigger:** User navigates to the "Video" page from the dashboard.

### Steps

1.  **Navigate to Video Page:**
    *   **Action:** User clicks on the "Video" link in the navigation bar.
    *   **System Response:** The application displays the "Video Generation" page with two tabs: "Text → Video" and "Image → Video".

2.  **Select Generation Mode:**
    *   **Action:** The user chooses between "Text → Video" or "Image → Video".
    *   **System Response:** The UI displays the relevant form fields for the selected mode.

3.  **Configure Video Settings (Text → Video):**
    *   **Action:** The user configures the parameters for the video generation.
    *   **Fields:**
        *   `Video Model`: A dropdown to select the AI model.
        *   `Video Prompt`: A text area for the user to describe the desired video content.
        *   `Duration`: A slider or input to set the video length.
        *   `Aspect Ratio`: A dropdown to select the video's aspect ratio.

4.  **Configure Video Settings (Image → Video):**
    *   **Action:** The user uploads a source image and configures the animation parameters.
    *   **Fields:**
        *   `Source Image`: An upload field for the starting image.
        *   (Other animation parameters as applicable)

5.  **Initiate Video Generation:**
    *   **Action:** User clicks the "Generate Video" button.
    *   **System Response:**
        *   The system deducts the corresponding credit amount from the user's account.
        *   A job is submitted to the backend to generate the video.
        *   The UI displays real-time logs and a progress indicator.

6.  **View Generated Video:**
    *   **Action:** Once the generation is complete, the video is displayed on the page.
    *   **System Response:** The user can play the generated video and has options to download or delete it.

### Post-conditions

*   Credits are deducted from the user's account.
*   A new video record is created in the database, associated with the user.
*   The generated video is available in the user's gallery.

---

## Gallery and Media Management

This flow describes how a user views, searches, and manages their generated images and videos.

**Trigger:** User navigates to the "Gallery" page from the dashboard.

### Steps

1.  **Navigate to Gallery Page:**
    *   **Action:** User clicks on the "Gallery" link in the navigation bar.
    *   **System Response:** The application displays the "Gallery" page, defaulting to the "Images" tab.

2.  **Switch Between Media Types:**
    *   **Action:** User can click on the "Images" or "Videos" tab.
    *   **System Response:** The gallery updates to show the corresponding media type.

3.  **View Media:**
    *   **Action:** The user's generated images or videos are displayed in a grid.
    *   **System Response:** The page may show a loading state while fetching the media. Each item in the grid is a thumbnail.

4.  **Search and Filter:**
    *   **Action:** The user can use the search bar to find media by prompt or use filters to narrow down the results (e.g., by date, model, etc.).
    *   **System Response:** The gallery dynamically updates to show the filtered results.

5.  **Manage Media:**
    *   **Action:** Clicking on a specific image or video opens a detailed view or a context menu.
    *   **System Response:** From the detailed view, the user has options to:
        *   Download the media.
        *   Delete the media.
        *   View metadata (e.g., prompt, seed, creation date).
        *   (Potentially) Re-edit or use as a base for a new generation.

### Post-conditions

*   User can effectively browse and manage their entire collection of generated content.
*   Deleting media removes it from the user's account and the database.

---

## Billing and Subscriptions

This flow describes how a user manages their subscription plan and billing information.

**Trigger:** User navigates to the "Billing" page from the dashboard or by clicking their avatar.

### Steps

1.  **Navigate to Billing Page:**
    *   **Action:** User clicks on the "Billing" link in the navigation bar or dropdown menu.
    *   **System Response:** The application displays the "Billing & Subscription" page.

2.  **View Current Plan:**
    *   **Action:** The user can see their current subscription plan, including the price, credit allocation, and remaining credits.
    *   **System Response:** The current plan is highlighted, and the "Current Plan" button is disabled.

3.  **Choose a New Plan:**
    *   **Action:** The user can browse through the available subscription plans ("Creator", "Pro", "Ultra"). Each plan card details the cost, features, and credit amount.
    *   **System Response:** The user can compare the different plans.

4.  **Upgrade Subscription:**
    *   **Action:** The user clicks the "Upgrade" button on their desired plan.
    *   **System Response:**
        *   The user is redirected to a Stripe checkout page to enter their payment information.
        *   Upon successful payment, the user's subscription is upgraded.
        *   The user is redirected back to the billing page, which now reflects the new plan.

### Post-conditions

*   The user's subscription status and plan are updated in the database.
*   The user's credit balance is updated according to the new plan.
*   A new billing cycle is initiated if applicable.

---

## User Logout

This flow describes how a user signs out of the application.

**Trigger:** User decides to end their session.

### Steps

1.  **Open User Menu:**
    *   **Action:** The user clicks on their avatar or user icon in the navigation bar.
    *   **System Response:** A dropdown menu appears with account-related options.

2.  **Initiate Logout:**
    *   **Action:** The user clicks the "Log out" button in the dropdown menu.
    *   **System Response:**
        *   The system terminates the user's session.
        *   The user is redirected to the public-facing landing page (`/`).
        *   The navigation bar updates to show "Login" and "Sign Up" buttons.

### Post-conditions

*   The user's session is terminated, and they are no longer authenticated.
*   The user is on the application's landing page.

---

## Image Editing

This flow describes how a user can edit an existing image using AI.

**Trigger:** User navigates to the "Edit" page from the dashboard.

### Steps

1.  **Navigate to Edit Page:**
    *   **Action:** User clicks on the "Edit" link in the navigation bar.
    *   **System Response:** The application displays the "Edit Image" page.

2.  **Upload Image:**
    *   **Action:** The user clicks on the upload area to select an image from their device.
    *   **System Response:** The selected image is displayed on the page, ready for editing.

3.  **Provide Edit Instructions:**
    *   **Action:** The user enters a text prompt describing the desired changes to the image.
    *   **System Response:** The "Edit Image" button becomes enabled.

4.  **Handle Premium Feature Gate:**
    *   **Action (for non-premium users):** The editing functionality is locked. The user is presented with information about the premium plan and a button to upgrade.
    *   **Action (for premium users):** The user can proceed with editing.

5.  **Initiate Image Editing:**
    *   **Action:** A premium user clicks the "Edit Image" button.
    *   **System Response:**
        *   The system deducts the corresponding credit amount.
        *   A job is submitted to the backend to perform the edit.
        *   The UI updates to show a progress indicator.

6.  **View Edited Image:**
    *   **Action:** Once the edit is complete, the new image is displayed.
    *   **System Response:** The user can view, download, or further edit the image.

### Post-conditions

*   Credits are deducted from the user's account (for premium users).
*   A new, edited image is created and associated with the user.
*   The edited image is available in the user's gallery. 

---

## Custom Models Management

This flow describes how a user manages their custom-trained AI models.

**Trigger:** User navigates to the "Models" page from the dashboard.

### Steps

1.  **Navigate to Models Page:**
    *   **Action:** User clicks on the "Models" link in the navigation bar.
    *   **System Response:** The application displays the "My Models" page.

2.  **Handle Premium Feature Gate:**
    *   **Action (for non-premium users):** The page displays a prompt to subscribe to a premium plan to unlock model creation.
    *   **Action (for premium users):** The page displays a list of the user's custom models.

3.  **View Custom Models (Premium):**
    *   **Action:** A premium user sees a list of their models, with details such as name, status (e.g., training, ready), and creation date.
    *   **System Response:** Each model has options to view details, generate images with it, or delete it.

4.  **Create a New Model (Premium):**
    *   **Action:** A premium user clicks a "Create New Model" or similar button.
    *   **System Response:** The user is redirected to the "Training" page to begin the model creation process.

### Post-conditions

*   Premium users can view and manage their custom models.
*   Deleting a model removes it from the user's account and makes it unavailable for generation. 

---

## Model Training

This flow describes how a premium user trains a new custom AI model.

**Trigger:** A premium user navigates to the "Training" page, often from the "My Models" page.

### Steps

1.  **Navigate to Training Page:**
    *   **Action:** User clicks on the "Training" link in the navigation bar or a "Create New Model" button.
    *   **System Response:** The application displays the "Train a New Model" page.

2.  **Name the Model:**
    *   **Action:** The user provides a descriptive name for their new model.
    *   **System Response:** The input is validated to ensure it's unique and meets any naming criteria.

3.  **Upload Training Images:**
    *   **Action:** The user uploads a set of images (e.g., 10-20 photos) that will be used to train the model. The images should be of high quality and clearly show the subject.
    *   **System Response:** The uploaded images are displayed as thumbnails, and the user can review or remove them before proceeding.

4.  **Configure Training Parameters:**
    *   **Action:** The user may have options to configure advanced training parameters, such as the number of training steps or the learning rate.
    *   **System Response:** The system provides sensible defaults for these parameters.

5.  **Initiate Training:**
    *   **Action:** The user clicks the "Start Training" button.
    *   **System Response:**
        *   The system validates the uploaded images and parameters.
        *   A training job is submitted to the backend.
        *   The user is redirected to the "My Models" page, where the new model appears with a "Training" status.

### Post-conditions

*   A new model record is created in the database with a "training" status.
*   The training process runs asynchronously in the background.
*   The user is notified when the training is complete and the model is ready for use. 

---

## User Settings

This flow describes how a user manages their account information, preferences, and security settings.

**Trigger:** User navigates to the "Settings" page from the user menu.

### Steps

1.  **Navigate to Settings Page:**
    *   **Action:** User clicks on the "Settings" link in the user dropdown menu.
    *   **System Response:** The application displays the "Account Settings" page with multiple tabs.

2.  **Manage Account Information:**
    *   **Action:** On the "Account" tab, the user can update their display name and email address.
    *   **System Response:** The user clicks "Save Changes" to apply the updates.

3.  **Manage Preferences:**
    *   **Action:** The user navigates to the "Preferences" tab to manage application-wide settings (e.g., theme, notification preferences).
    *   **System Response:** Changes are saved automatically or via a save button.

4.  **Manage Security:**
    *   **Action:** The user navigates to the "Security" tab to change their password or manage other security-related settings.
    *   **System Response:** The user follows a standard password change process (current password, new password, confirm new password).

5.  **Manage Privacy:**
    *   **Action:** The user navigates to the "Privacy" tab to manage data and privacy settings, such as exporting or deleting their data.
    *   **System Response:** The user can request data exports or initiate account deletion.

### Post-conditions

*   User's account information is updated in the database.
*   Application preferences are saved and applied.
*   Security settings, like the user's password, are updated. 