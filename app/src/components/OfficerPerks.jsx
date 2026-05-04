import React, { useState } from 'react';

const CATEGORIES = ['All', 'Food & Drink', 'Health & Fitness', 'Entertainment', 'Finance', 'Motoring', 'Shopping', 'Travel', 'Wellbeing'];

const PERKS = [
  // Food & Drink
  { name: 'Blue Light Card', category: 'Shopping', desc: 'Exclusive discounts for emergency services and armed forces. Thousands of offers online and in-store.', discount: 'Up to 50% off', url: 'https://www.bluelightcard.co.uk', color: '#1a52a8', icon: '💳' },
  { name: 'Nando\'s', category: 'Food & Drink', desc: '20% off for Blue Light Card holders. Show your card at the till.', discount: '20% off', url: 'https://www.nandos.co.uk', color: '#dc2626', icon: '🍗' },
  { name: 'Pizza Hut', category: 'Food & Drink', desc: 'Blue Light Card discount on dine-in and collection orders.', discount: '25% off', url: 'https://www.pizzahut.co.uk', color: '#dc2626', icon: '🍕' },
  { name: 'Costa Coffee', category: 'Food & Drink', desc: 'Discount on all drinks through the Costa app for security workers.', discount: '10% off', url: 'https://www.costa.co.uk', color: '#6d1d4a', icon: '☕' },
  { name: 'Greggs', category: 'Food & Drink', desc: 'Free hot drink with any meal deal via Greggs app (register with work email).', discount: 'Free hot drink', url: 'https://www.greggs.co.uk/app', color: '#0066b2', icon: '🥪' },
  // Health & Fitness
  { name: 'PureGym', category: 'Health & Fitness', desc: 'Discounted membership for shift workers. No contract, 24/7 access works around your shifts.', discount: 'From £9.99/mo', url: 'https://www.puregym.com/corporate/', color: '#fbbf24', icon: '💪' },
  { name: 'The Gym Group', category: 'Health & Fitness', desc: 'Corporate rates for security sector employees. 24/7 access, no contract.', discount: '20% off', url: 'https://www.thegymgroup.com/corporate/', color: '#e11d48', icon: '🏋️' },
  { name: 'Hussle', category: 'Health & Fitness', desc: 'Multi-gym pass — access hundreds of gyms and pools near your sites.', discount: '10% off', url: 'https://www.hussle.com', color: '#7c3aed', icon: '🏊' },
  // Entertainment
  { name: 'Cineworld', category: 'Entertainment', desc: 'Unlimited Card at a discounted rate for security professionals.', discount: '20% off', url: 'https://www.cineworld.co.uk/unlimited', color: '#0f172a', icon: '🎬' },
  { name: 'Spotify', category: 'Entertainment', desc: 'Premium plan — keep entertained on long night shifts.', discount: '3 months free', url: 'https://www.spotify.com/uk/premium/', color: '#1DB954', icon: '🎵' },
  { name: 'Audible', category: 'Entertainment', desc: 'Audiobooks and podcasts — perfect for lone workers on quiet shifts.', discount: '30-day free trial', url: 'https://www.audible.co.uk', color: '#f97316', icon: '🎧' },
  // Finance
  { name: 'Wagestream', category: 'Finance', desc: 'Access your earned wages before payday. No credit checks, no interest.', discount: 'Free to join', url: 'https://wagestream.com', color: '#6366f1', icon: '💰' },
  { name: 'Salary Finance', category: 'Finance', desc: 'Low-cost loans, savings, and financial education for employees.', discount: 'Low-rate loans', url: 'https://www.salaryfinance.com', color: '#0891b2', icon: '🏦' },
  // Motoring
  { name: 'Halfords', category: 'Motoring', desc: 'Discount on MOTs, servicing, and motoring essentials. Useful for officers who drive between sites.', discount: '10% off', url: 'https://www.halfords.com', color: '#1a52a8', icon: '🚗' },
  { name: 'Shell Go+', category: 'Motoring', desc: 'Save on fuel — earn rewards every time you fill up on the way to site.', discount: '3p/litre off', url: 'https://www.shell.co.uk/motorist/go-plus.html', color: '#fbbf24', icon: '⛽' },
  // Wellbeing
  { name: 'Headspace', category: 'Wellbeing', desc: 'Free meditation and sleep tools. Helpful for managing shift-work fatigue and stress.', discount: '30-day free', url: 'https://www.headspace.com', color: '#f97316', icon: '🧘' },
  { name: 'SHOUT Text Line', category: 'Wellbeing', desc: 'Free 24/7 text support. Text SHOUT to 85258 if you\'re struggling with anything.', discount: 'Free', url: 'https://giveusashout.org', color: '#16a34a', icon: '💬' },
  { name: 'Hub of Hope', category: 'Wellbeing', desc: 'Find local mental health support near your home or site. The UK\'s leading mental health database.', discount: 'Free', url: 'https://hubofhope.co.uk', color: '#0891b2', icon: '🤝' },
  // Travel
  { name: 'CSSC', category: 'Travel', desc: 'Civil Service & public sector leisure — theme parks, holidays, and days out at discounted rates.', discount: 'Up to 40% off', url: 'https://www.cssc.co.uk', color: '#1a52a8', icon: '✈️' },
  // Shopping
  { name: 'Amazon Prime', category: 'Shopping', desc: 'Free delivery on night shift essentials — snacks, torches, thermals, boots.', discount: '30-day free trial', url: 'https://www.amazon.co.uk/prime', color: '#f97316', icon: '📦' },
  { name: 'Screwfix', category: 'Shopping', desc: 'Discount on torches, PPE, batteries, and kit for security officers.', discount: '10% off', url: 'https://www.screwfix.com', color: '#0066b2', icon: '🔦' },
];

export default function OfficerPerksScreen() {
  const [category, setCategory] = useState('All');
  const filtered = category === 'All' ? PERKS : PERKS.filter(p => p.category === category);

  return (
    <div style={{padding:'1rem',paddingBottom:'5rem'}}>
      <h2 style={{fontSize:'1.125rem',fontWeight:700,color:'#fff',marginBottom:'0.25rem'}}>Officer Perks</h2>
      <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.4)',marginBottom:'1rem',lineHeight:1.5}}>
        Exclusive discounts and offers for security professionals. Tap any offer to sign up or find out more.
      </p>

      {/* Category filter */}
      <div style={{display:'flex',gap:'0.375rem',overflowX:'auto',paddingBottom:'0.75rem',marginBottom:'0.75rem',WebkitOverflowScrolling:'touch'}}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            style={{padding:'0.375rem 0.75rem',background: category===c ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
              border: category===c ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius:'20px',color: category===c ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              fontSize:'0.75rem',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {c}
          </button>
        ))}
      </div>

      {/* Offers grid */}
      <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
        {filtered.map((perk, i) => (
          <a key={i} href={perk.url} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',gap:'0.875rem',padding:'1rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',textDecoration:'none',transition:'background 0.15s',cursor:'pointer'}}>
            <div style={{width:'48px',height:'48px',borderRadius:'12px',background:`${perk.color}22`,border:`1px solid ${perk.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',flexShrink:0}}>
              {perk.icon}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'0.5rem'}}>
                <div style={{fontSize:'0.9375rem',fontWeight:700,color:'#fff'}}>{perk.name}</div>
                <div style={{padding:'0.125rem 0.5rem',background:`${perk.color}22`,border:`1px solid ${perk.color}44`,borderRadius:'6px',fontSize:'0.6875rem',fontWeight:700,color:perk.color,whiteSpace:'nowrap',flexShrink:0}}>
                  {perk.discount}
                </div>
              </div>
              <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.45)',lineHeight:1.5,marginTop:'0.25rem'}}>{perk.desc}</div>
              <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.25)',marginTop:'0.375rem'}}>{perk.category}</div>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{padding:'2rem',textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>
          No offers in this category yet.
        </div>
      )}

      <div style={{marginTop:'1.5rem',padding:'1rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'10px',fontSize:'0.75rem',color:'rgba(255,255,255,0.3)',lineHeight:1.5,textAlign:'center'}}>
        These offers are provided as a benefit to our officers. Risk Secured Ltd is not affiliated with and does not endorse any third-party provider listed above. Offers may change without notice.
      </div>
    </div>
  );
}
