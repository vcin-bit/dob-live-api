import { useState } from "react";

export default function PhotoPickerModal({ open, onClose, onFilesSelected }) {
  const [isPicking, setIsPicking] = useState(false);

  if (!open) return null;

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsPicking(true);
    try {
      await onFilesSelected(files);
      onClose?.();
    } finally {
      e.target.value = "";
      setIsPicking(false);
    }
  };

  const isCriOS = /CriOS/i.test(navigator.userAgent);

  return (
    <div onClick={onClose} style={{position:'absolute',inset:0,zIndex:9999,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'16px'}}>
      <div onClick={(e) => e.stopPropagation()} style={{width:'100%',maxWidth:'480px',background:'#0f1929',borderRadius:'16px',padding:'16px',border:'1px solid rgba(255,255,255,0.1)'}}>
        <div style={{fontSize:'15px',fontWeight:600,color:'#fff',marginBottom:'12px'}}>Add Photo</div>
        <div style={{display:'grid',gap:'10px'}}>
          <label style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'52px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',fontWeight:600,fontSize:'13px',color:'#fff',overflow:'hidden',WebkitTapHighlightColor:'transparent',cursor:'pointer'}}>
            <span>Take Photo</span>
            <input type="file" accept="image/*" {...(!isCriOS ? { capture: "environment" } : {})} onChange={handleChange} disabled={isPicking} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer'}} />
          </label>
          <label style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'52px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',fontWeight:600,fontSize:'13px',color:'#fff',overflow:'hidden',WebkitTapHighlightColor:'transparent',cursor:'pointer'}}>
            <span>From Gallery</span>
            <input type="file" accept="image/*" multiple onChange={handleChange} disabled={isPicking} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer'}} />
          </label>
        </div>
        <button onClick={onClose} style={{marginTop:'10px',width:'100%',minHeight:'48px',border:0,borderRadius:'12px',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
