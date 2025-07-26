---
# Flux LoRA: Preventing Male-to-Female Gender Flips

Flux LoRA models sometimes “flip” the subject’s gender because the adapter is trying to balance what it learned from your small, possibly ambiguous dataset with the huge latent priors inside the base diffusion model. Below are the most effective ways hobbyists and researchers have found to keep a male identity male—from dataset prep, to training settings in Runway, to the prompts you use at generation time.

---

## Why the model mis-genders

* **Dataset imbalance & ambiguity** – If your training set contains too many close-ups without clear masculine cues (short hair, jawline, facial hair, clothing), the text encoder can’t reliably associate your subject token with “man.” Small LoRAs (rank 4-16) easily overfit on spurious visual details and then fall back to the base model’s broader priors, which are still biased toward stereotypical beauty cues that skew female. ([Reddit][1], [Reddit][2])
* **Weak or missing gender tokens in captions** – Many Runway/Flux tutorials omit gender words in the automatic captions, so the model never gets an explicit “male” concept tied to your name token. ([Reddit][2])
* **Base-model bias** – Several papers have measured that even SDXL-derived checkpoints overrepresent women for neutral prompts; those priors bleed into LoRA generations. ([Nature][3], [MDPI][4])

---

## 1. Curate a rock-solid, unmistakably male dataset

| Checklist item                                            | Why it matters                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| 25–50 photos, minimum 2048 px                             | Gives the adapter enough variety without drowning it. ([Reddit][1])        |
| Mix of face, half-body, full-body, profiles               | Teaches proportions and prevents the model from swapping body types later. |
| Consistent masculine cues (stubble, short hair, menswear) | Reinforces gender token. Remove any images where you appear androgynous.   |
| Neutral backgrounds & lighting variations                 | Helps generalize but avoids confusing context (no crowded party shots).    |
| No other people—especially no women—in frame              | Prevents token bleeding.                                                   |

---

## 2. Caption every image explicitly

Runway lets you upload a CSV or edit captions inline. For each file:

```
"photo of <geo_ppls> man, 30-year-old software engineer, short brown hair, stubble, casual t-shirt"
```

* The **subject token** (`<geo_ppls>`) anchors identity; the **word “man”** anchors gender.
* Avoid a single-word caption (“man”); it makes the LoRA rigid and may even remove identity variation. ([Reddit][2])

---

## 3. Tune training settings in Runway

| Parameter                       | Recommended value                        | Rationale                                                                               |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| **Rank / α**                    | 8–16 / 4                                 | Lower rank can “forget” gender cues; higher rank >32 often overfits.                    |
| **Text encoder learning rate**  | 5e-5 (same as default)                   | Needed to fuse the “man” token properly. ([The Interactive & Immersive HQ][5])          |
| **Image encoder learning rate** | 1e-4                                     | Keeps visual features sharp.                                                            |
| **Epochs / steps**              | 5–10 epochs; stop early if loss flattens | Too many epochs will erase variety and push toward base priors again.                   |
| **Regularization images**       | 250 SDXL male portraits                  | Helps the adapter learn male anatomy without copying any single face. ([OpenReview][6]) |

Runway’s UI hides regularization uploads under **Advanced → Dataset options**; point it at a zip of generic male photos.

---

## 4. Use gender-locked prompts when generating

```
portrait of <geo_ppls> man, cinematic lighting, depth of field
--negative "female, woman, girl, long hair, makeup"
```

* Keep the **subject token + “man”** together early in the prompt; SD guidance weights the first tokens more.
* A strong negative list (“female, girl, long hair…”) consistently suppresses gender flips. ([YouTube][7])
* If Runway exposes a **LoRA weight slider**, start at 0.9 – 1.1. Too low lets base bias dominate; too high can warp anatomy.

---

## 5. Validate & iterate

1. **Batch-generate 20–30 samples** with random seeds after each training pass.
2. Tag any mis-gendered outputs and inspect their prompts/negatives.
3. If flips persist, add 3–5 more training photos emphasizing the missed cue (e.g., close-up of stubble) and resume training for 2 epochs.

This incremental loop mirrors best practice from long-form FluxGYM/ComfyUI workflows. ([The Interactive & Immersive HQ][5])

---

## 6. Advanced safeguards

* **Identity embedding-loss fine-tune** – Some users run a short DreamBooth stage with a face-ID loss before LoRA to lock gender; see FluxGYM + ComfyUI guides. ([YouTube][7])
* **Bias-adapter add-on** – Research like MoESD shows you can attach a “male-expert” adapter to suppress gender drift without touching your LoRA. ([arXiv][8], [arXiv][9])
* **Prompt-time re-weighting** – The Stable Bias paper suggests adding `{{man}}^1.5` syntax (if your front-end supports token weights) to over-emphasize gender. ([NeurIPS Proceedings][10])

---

## Quick-reference recipe

>  **Dataset**: 40 photos, variety of poses, no females, clear masculine cues.
>  **Captions**: `photo of <geo_ppls> man …`.
>  **Runway settings**: rank = 8-16, lr = 1e-4 / 5e-5, 250 male reg imgs, 5-8 epochs.
>  **Prompt**: `<geo_ppls> man …` with strong negative list.
>  **Iterate**: add targeted photos + 2 epochs if flips continue.

Follow this pipeline and you should see female mis-generations drop to near-zero without sacrificing pose or style flexibility.

[1]: https://www.reddit.com/r/StableDiffusion/comments/13dh7ql/after_training_50_lora_models_here_is_what_i/?utm_source=chatgpt.com "After training 50+ LoRA Models here is what I learned (TIPS) - Reddit"
[2]: https://www.reddit.com/r/StableDiffusion/comments/1dul5sh/what_is_the_issue_or_downside_of_using_man_or/?utm_source=chatgpt.com "What is the issue or downside of using “man” or “woman” as the only ..."
[3]: https://www.nature.com/articles/s41598-025-99623-3?utm_source=chatgpt.com "AI-generated faces influence gender stereotypes and racial ... - Nature"
[4]: https://www.mdpi.com/2313-433X/11/2/35?utm_source=chatgpt.com "Revealing Gender Bias from Prompt to Image in Stable Diffusion"
[5]: https://interactiveimmersive.io/blog/artificial-intelligence/fluxgym-to-comfyui-building-and-using-custom-loras/?utm_source=chatgpt.com "FLUXGYM to ComfyUI: Building and Using a Custom LoRA"
[6]: https://openreview.net/forum?id=39cPKijBed&utm_source=chatgpt.com "Training Unbiased Diffusion Models From Biased Dataset"
[7]: https://www.youtube.com/watch?v=wbmTN1qLDnY&utm_source=chatgpt.com "ComfyUI Tutorial Series Ep 53: Flux Kontext LoRA Training with Fal AI"
[8]: https://arxiv.org/html/2407.11002v1?utm_source=chatgpt.com "MoESD: Mixture of Experts Stable Diffusion to Mitigate Gender Bias"
[9]: https://arxiv.org/html/2407.11002v2?utm_source=chatgpt.com "MoESD: Mixture of Experts Stable Diffusion to Mitigate Gender Bias"
[10]: https://proceedings.neurips.cc/paper_files/paper/2023/file/b01153e7112b347d8ed54f317840d8af-Paper-Datasets_and_Benchmarks.pdf?utm_source=chatgpt.com "Stable Bias: Evaluating Societal Representations in Diffusion Models" 