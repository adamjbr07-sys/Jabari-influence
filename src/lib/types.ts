export type Category =
  | 'gym'
  | 'muslim-arab'
  | 'engineering'
  | 'canadian'
  | 'arab-canadian'

export interface ContentIdea {
  id: string
  text: string
  category: Category
  createdAt: number
}

export interface HookOutput {
  hookText: string
  tiktokCaption: string
  igCaption: string
}
