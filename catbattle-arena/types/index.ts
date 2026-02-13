export interface Submission {
  id: string;
  image_url: string;
  name: string;
  bio?: string;
  owner_ig?: string;
  status: 'pending' | 'approved' | 'rejected';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'God-Tier';
  stats: {
    attack: number;
    defense: number;
    speed: number;
    charisma: number;
    chaos: number;
  };
  power: string;
  votes: number;
  win_rate: number;
  xp: number;
  max_xp: number;
  evolution: 'Kitten' | 'Elite Floof' | 'Battle Beast' | 'Supreme Overlord';
  level: number;
  battles_fought: number;
  created_at: string;
}

export interface Vote {
  id: string;
  cat_id: string;
  voter_ip: string;
  created_at: string;
}

export interface Battle {
  id: string;
  cat_a_id: string;
  cat_b_id: string;
  winner_id?: string;
  created_at: string;
}

export type CatCard = Submission;
